#!/usr/bin/env node
/**
 * score.js — Daily News 4기준 휴리스틱 채점 + LLM 훅.
 *
 * 사용:
 *   node scripts/score.js                            # data/raw-collection.json → data/scored-items.json
 *   node scripts/score.js --in=PATH --out=PATH       # I/O 경로 지정
 *   node scripts/score.js --llm                      # LLM 호출 (env: ANTHROPIC_API_KEY)
 *
 * 4기준 (각 0..5):
 *   impact     — 산업·시장 구조 변화 + 의사결정자 행동 변화
 *   freshness  — 게시 시점 + 1차 보도 여부 + 후속 보도 비율
 *   depth      — 기술 난이도·구현 디테일·재현 가능성·외부 검증
 *   buzz       — 커뮤니티·SNS 반응 + 시간당 증가율 + 즉시 적용성
 *
 * Heuristic 기본 동작 (LLM 없이도 합리적 시작값):
 *   - impact:    source authority × keyword 가중치
 *   - freshness: 1 - (age_hours / window_hours), clamp 0..5
 *   - depth:     기술 키워드 카운트 + 요약 길이 + URL 도메인 보너스
 *   - buzz:      points (HN/GH stars) log normalize
 *
 * --llm 모드에서는 Claude Haiku 호출로 휴리스틱을 개선 (선택적).
 *
 * 출력: scored Item[]은 validate-data.js의 schema 와 호환:
 *   { id, title, category, url, source, sourceCountry, publishedAt,
 *     summary, scores: {impact, freshness, depth, buzz}, tags[], featured }
 *
 * 의존: Node 20+ built-in fetch (LLM 호출 시).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const { CATEGORY_KEYS } = require("./spec");
const CATEGORY_SET = new Set(CATEGORY_KEYS);

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_IN  = path.join(ROOT, "data", "raw-collection.json");
const DEFAULT_OUT = path.join(ROOT, "data", "scored-items.json");

// ── CLI ────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, llm: false, windowHours: 24 };
  for (const a of argv.slice(2)) {
    if (a === "--llm") args.llm = true;
    else if (a.startsWith("--in="))  args.in  = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--out=")) args.out = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--hours=")) args.windowHours = parseInt(a.split("=")[1], 10);
  }
  return args;
}

// ── 신호 → 점수 변환 ────────────────────────────────────
const SOURCE_AUTHORITY = {
  // Tier 1 — primary source / 1차 보도 (사업자 직접 발표)
  "openai":             5.0, "anthropic":      5.0, "google_ai":   5.0,
  "meta_ai":            4.9, "hf_blog":        4.7,
  // Tier 1.5 — major IT 미디어
  "mit_tech_review":    4.7, "ieee_spectrum":  4.6, "arstechnica": 4.6,
  "techcrunch":         4.5, "theverge":       4.4, "wired":       4.4,
  "engadget":           4.0,
  // Tier 1.5 — DevTools 사업자
  "vercel":             4.6, "supabase":       4.5, "github_blog": 4.5,
  "cloudflare":         4.5, "netlify":        4.0,
  // Tier 1.5 — AX 미디어
  "pragmatic_eng":      4.6, "leaddev":        4.4, "honeycomb":   4.5,
  "shopify_eng":        4.5, "github_eng":     4.5,
  // Tier 1.5 — 한국 IT 미디어
  "bloter":             4.4, "itworld_kr":     4.3, "zdnet_kr":    4.3,
  "yna_it":             4.5, "byline_kr":      4.3,
  // 🆕 Round 8: 한국 IT 전용 추가 (Tier 1.5)
  "techm":              4.4, "aitimes":        4.4, "digitaltoday":  4.2,
  "itchosun":           4.3, "thelec":         4.5,
  "toss_tech":          4.6, "naver_d2":       4.6, "kakao_tech":  4.5,
  "woowa_tech":         4.5,
  // 🆕 Round 8: 글로벌 IT 미디어 추가 (Tier 1.5)
  "register":           4.4, "tnw":            4.2, "tomshardware":  4.3,
  "techradar":          4.0, "zdnet":          4.4, "cnet":          4.0,
  "gizmodo":            4.0, "newstack":       4.4, "infoq":         4.4,
  "infoworld":          4.2, "computerworld":  4.0, "siliconangle":  4.0,
  "bloomberg_tech":     4.0, "reuters_tech":   4.0, "ft_tech":       4.0,
  "guardian_tech":      4.0, "fastcompany":    3.8, "businessinsider_tech": 3.8,
  "venturebeat":        4.4, "theinformation": 4.6, "404media":      4.3,
  "axios_tech":         4.2, "axios_login":    4.2,
  "deepmind":           5.0, "mistral_ai":     4.7, "stability_ai":  4.5,
  "stripe":             4.6, "render":         4.3, "stripe_eng":    4.6,
  "netflix_tech":       4.6, "uber_eng":       4.6, "hashnode":      3.7,
  // SNS 계정 (낮은 권위 — 헤드라인 후보 아님)
  "fosstodon_dev":      3.6, "mast_simonw":    4.0, "mast_pluralistic": 3.8,
  "mast_briankrebs":    4.2, "mast_swiftonsec": 3.8, "mast_aaronpk": 3.8,
  "bsky_karpathy":      4.2, "bsky_simonw":    4.0, "bsky_swyx":     3.9,
  "x_sama":             4.0, "x_levelsio":     3.7,
  // Substack 뉴스레터
  "stratechery":        4.7, "platformer":     4.4, "lennys":        4.0,
  "tldr_ai":            4.2, "import_ai":      4.5,
  "yt_yannic":          4.2, "yt_lex":         4.0,
  // 🌏 Round 9: 세계 IT 10대 강국 매체 권위 (각국 대표 IT 미디어)
  // 🇨🇳 중국 — 36kr/PingWest/ifanr 메이저
  "cn_36kr":            4.5, "cn_pingwest":    4.3, "cn_ifanr":      4.1,
  "cn_geekpark":        4.2, "cn_huxiu":       4.0, "cn_itzhi":      4.0,
  // 🇯🇵 일본 — ITmedia/Publickey 톱
  "jp_itmedia":         4.5, "jp_gigazine":    4.0, "jp_ascii":      4.2,
  "jp_pcwatch":         4.3, "jp_publickey":   4.5,
  // 🇩🇪 독일 — Heise 톱
  "de_heise":           4.5, "de_golem":       4.3, "de_computerwoche": 4.0,
  // 🇮🇳 인도 — Inc42/YourStory/Analytics India
  "in_yourstory":       4.2, "in_inc42":       4.3, "in_analytics":  4.4,
  "in_toi_tech":        3.8,
  // 🇮🇱 이스라엘 — Calcalist Tech (CTech)
  "il_ctech":           4.4, "il_globes":      4.0,
  // 🇹🇼 대만 — iThome (TW)/DigiTimes
  "tw_ithome":          4.4, "tw_inside":      4.2, "tw_techorange": 4.0,
  "tw_digitimes":       4.6,  // DigiTimes 반도체 분석 톱
  // 🇫🇷 프랑스 — Numerama
  "fr_numerama":        4.3, "fr_jdn":         4.0, "fr_frenchweb":  4.0,
  // 🇨🇦 캐나다 — BetaKit
  "ca_betakit":         4.2, "ca_mobilesyrup": 4.0,
  // Tier 1 — Papers (arxiv는 1차 학술 자료)
  "arxiv_cs_ai":        4.7, "arxiv_cs_lg":    4.7, "arxiv_cs_cl": 4.7,
  // Tier 2 — community aggregator
  "hackernews":         4.0, "github_trending": 4.2, "reddit":     3.7,
  "geeknews":           4.0, "lobsters":       3.9, "devto":       3.5,
  // Tier 3 — fallback
  "_default":           3.5,
};

const IMPACT_KEYWORDS = {
  // 강한 신호
  "GA":              1.0, "general availability": 1.0,
  "launch":          0.8, "released":   0.7, "announce": 0.6,
  "deprecat":        0.7, "shutdown":   0.7, "EOL":      0.6,
  "acquisition":     0.9, "IPO":        0.9, "Series":   0.7,
  "breakthrough":    0.7, "first":      0.5, "milestone": 0.5,
  // 산업 표준 / 결정 강제
  "standard":        0.6, "RFC":        0.5, "spec":     0.4,
  "must":            0.3, "required":   0.3,
};

// PERF Round 4 (Expert 2 Egorov + Expert 8 Caswell):
// Object.entries(IMPACT_KEYWORDS)는 매 item마다 array 생성 + key는 매번 toLowerCase.
// 모듈-레벨에 한 번만 lowercase pre-computed [key, weight] 튜플로 hoist.
// 2016 items × 22 entries = 44k 불필요 toLowerCase 호출 제거.
const IMPACT_KW_LC = Object.entries(IMPACT_KEYWORDS).map(([k, w]) => [k.toLowerCase(), w]);

// PERF Round 4 (Expert 2): 5개 별도 regex 배열 → 단일 결합 alternation regex.
// V8가 각 패턴을 독립 NFA로 traversal 하던 것을 하나의 결합 NFA로 amortize.
// /g 플래그 + matchAll로 1-pass count.
const DEPTH_REGEX = /\b(?:benchmark|paper|arxiv|open[- ]?source|transformer|attention|LSTM|RNN|CNN|GAN|VAE|RAG|reasoning|latency|throughput|p99|p95|TFLOPS|TPS|QPS|memory|bandwidth|SDK|API|protocol|implementation|architecture|infrastructure|code|repo|commit|PR|merge|review)\b/gi;

/**
 * IT_RELEVANCE — 사용자 피드백 ("헤드라인이 IT Daily News와 관련이 없어")
 *
 * HN/Reddit 같은 aggregator는 비-IT 화제(인터뷰·역사·여행기)도 종종 1위에 오른다.
 * 점수가 아무리 높아도 IT 관련성이 0이면 헤드라인이 될 수 없도록 게이트를 추가.
 *
 * 0..1 스칼라:
 *   1.0 = 명백한 IT (AI/devtools/cloud/semiconductor/hardware/sw eng)
 *   0.5 = 인접 (디자인 도구, 프로덕트 매니지먼트, 데이터 사이언스 비즈니스)
 *   0.0 = 비-IT (정치, 라이프스타일, 의료, 금융 일반, 스포츠)
 *
 * 모든 점수 채널에 곱해져 비-IT 항목을 시스템적으로 demote.
 * 헤드라인 임계: 종합점수 ≥ 4.0 AND relevance ≥ 0.6.
 */
const IT_KEYWORDS_STRONG = [
  // AI / ML — 핵심
  /\b(AI|ML|LLM|GPT|Claude|Gemini|Llama|Mistral|DeepSeek|Qwen)\b/i,
  /\b(OpenAI|Anthropic|Google AI|DeepMind|Hugging ?Face|Cohere|xAI)\b/i,
  /\b(transformer|neural network|deep learning|machine learning|fine-?tun|pretrain)\b/i,
  /\b(embedding|vector|RAG|retrieval|prompt|inference|tokeniz|context window)\b/i,
  /\b(reasoning|agent|MCP|computer use|chain of thought|test-time)\b/i,
  // SW Engineering / DevTools
  /\b(API|SDK|framework|library|runtime|compiler|interpreter|database|kubernetes|docker)\b/i,
  /\b(GitHub|GitLab|npm|pip|cargo|maven|gradle|webpack|vite|esbuild|turbopack)\b/i,
  /\b(React|Vue|Svelte|Angular|Next|Remix|Astro|Tailwind|TypeScript|JavaScript|Rust|Go|Python)\b/i,
  /\b(cloud|serverless|edge|CDN|microservic|monolith|container|kubernetes|terraform)\b/i,
  /\b(Vercel|Netlify|Cloudflare|AWS|GCP|Azure|Supabase|Firebase|Linear|Stripe)\b/i,
  // Hardware / Semiconductor
  /\b(GPU|CPU|TPU|NPU|ASIC|FPGA|SoC|chip|silicon|wafer|fab|foundry)\b/i,
  /\b(NVIDIA|AMD|Intel|TSMC|Samsung|SK Hynix|ARM|Apple Silicon|M[1234])\b/i,
  /\b(CUDA|TensorRT|HBM|DDR|PCIe|NVLink|NVSwitch|InfiniBand)\b/i,
  // Mobile / Display / Robot
  /\b(iPhone|iPad|Android|Galaxy|Pixel|foldable|폴더블|OLED|microLED|AR|VR|XR|MR)\b/i,
  /\b(humanoid|robot|autonomous|self-driving|Tesla bot|Optimus|Figure)\b/i,
  // SW Practice
  /\b(open[- ]?source|repo|repository|deployment|CI\/CD|DevOps|SRE|observability)\b/i,
  /\b(latency|throughput|benchmark|performance|scaling|distributed)\b/i,
  // Korean tech
  /(삼성|LG|네이버|카카오|토스|쿠팡|당근|배민|라인|넷마블|크래프톤|엔씨|카카오뱅크|네카라쿠배)/,
  /(반도체|디스플레이|폴더블|클라우드|개발자|소프트웨어|하드웨어|인공지능|머신러닝)/,
  // 🌏 Round 9: 세계 IT 10대 강국 핵심 IT 키워드
  // 🇨🇳 중국 — 인공지능/클라우드/반도체/플랫폼
  /(人工智能|機器學習|深度學習|大模型|半導體|芯片|晶片|雲端|雲計算|互聯網|軟件|开源|开发者)/,
  /(腾讯|阿里|百度|字节|华为|小米|京东|美团|拼多多|滴滴|网易|快手|蚂蚁|蔚来|理想|小鹏)/,
  // 🇯🇵 일본 — 半導体/AI/クラウド/開発
  /(人工知能|機械学習|深層学習|大規模言語モデル|半導体|チップ|クラウド|オープンソース|開発者|ソフトウェア|ハードウェア)/,
  /(ソニー|トヨタ|ホンダ|日立|富士通|NEC|ソフトバンク|楽天|メルカリ|LINE|ヤフー)/,
  // 🇩🇪 독일 — Halbleiter/KI/Software
  /\b(Halbleiter|Künstliche Intelligenz|KI|Maschinelles Lernen|Cloud-Computing|Open[- ]Source|Entwickler|Softwareentwicklung)\b/i,
  /\b(SAP|Siemens|Bosch|Infineon|Trumpf|TeamViewer|N26|Celonis)\b/,
  // 🇮🇱 이스라엘 / 🇹🇼 대만 / 🇫🇷 프랑스 IT 핵심
  /\b(unicorn|cyber(?:security|attack)|fintech|biotech|deep[- ]?tech|hardtech|AI startup|cloud-native|datacenter)\b/i,
];

const IT_KEYWORDS_MEDIUM = [
  /\b(design system|figma|sketch|prototype|wireframe|UX|UI|user research)\b/i,
  /\b(product manage|PM|sprint|agile|scrum|jira|notion|slack|linear)\b/i,
  /\b(data science|analytics|dashboard|visualization|tableau|looker|metabase)\b/i,
  /\b(crypto|blockchain|web3|NFT|smart contract|defi|ethereum|bitcoin)\b/i,
  /\b(IoT|smart home|wearable|EV|electric vehicle|battery)\b/i,
];

const IT_NEGATIVE_KEYWORDS = [
  // 명백한 비-IT 토픽 — 점수 강하게 깎음
  /\b(election|politics|congress|senate|president(?!ia)|trump|biden|harris)\b/i,
  /\b(recipe|cooking|baking|cuisine|restaurant|chef|ingredient)\b/i,
  /\b(travel|tourist|vacation|hotel|flight|cruise)\b/i,
  /\b(workout|fitness|diet|yoga|meditation|spiritual)\b/i,
  /\b(NBA|NFL|MLB|FIFA|olympic|football|basketball|baseball|soccer|tennis)\b/i,
  /\b(album|concert|musician|guitar|pianist|orchestra|opera|jazz|rock band)\b/i,
  /\b(novel|fiction|poetry|memoir|biography(?!.*tech))\b/i,
  /\b(divorce|wedding|marriage|relationship advice|dating)\b/i,
  /\b(climate change(?!.*model)|carbon footprint(?!.*data)|wildfire(?!.*sensor))\b/i,
  /(요리|레시피|여행|운동|다이어트|연애|결혼|이혼|정치|선거|국회)/,
  // 🆕 Round 8 Expert 1+5 권고 — 한국 금융/증권/일반 비즈니스 (신한證 leak 방지)
  /(증권|공시|실적|매출|영업이익|순이익|주가|주식|시가총액|시총|코스피|코스닥|상장|배당|펀드|투자자문|애널리스트|목표주가|매수의견|매도의견|컨센서스|분기실적|반기실적|연간실적|호실적|어닝쇼크|어닝서프라이즈|증권사|증권가)/,
  /(국회|대통령|장관|총리|여당|야당|민주당|국민의힘|정부발표|법안|개정안|시행령|금감원|공정위|국세청|수사|영장|기소|선고|판결)/,
  /(연예|아이돌|드라마|예능|배우|가수|영화관|박스오피스|부동산|아파트|전세|월세|분양|청약)/,
  /(턴어라운드|목표가|매수의견|호실적|밸류에이션|어닝콜)/,
  // 영문 금융 노이즈
  /\b(earnings (?:beat|miss|call|report)|quarterly results|EPS guidance|analyst rating|price target|short interest|hedge fund|13F filing)\b/i,
  /\b(stock(?!.*overflow)|shares (?:up|down|jump|fall)|share price|market cap|valuation|IPO pricing|SPAC|tender offer)\b/i,
  // 범죄/비-기술-정책 법적 이슈
  /\b(lawsuit settlement|criminal charge|indictment|guilty plea|prison sentence|murder|homicide)\b/i,
  // 부동산/라이프스타일
  /\b(real estate|mortgage|housing market|home sale|interior design(?!.*system))\b/i,
];

// 🆕 Round 8 Expert 2 (multi-signal classifier): 한국 증권사 분석 보고서 패턴.
// "신한證 '지슨, 올해 상반기 턴어라운드…신사업 호조'" 같은 stock-analyst note shape.
// 멀티-패턴 hard cap — 단일 매칭만 있어도 relevance 강하게 떨어짐.
const IT_EQUITY_RE = new RegExp([
  /(신한|미래에셋|키움|삼성|NH|하나|KB|대신|메리츠|한투|유안타|이베스트|신영|한화|교보|SK|현대차|DB|하이|상상인|유진)[證증]/.source,
  /(목표주가|투자의견|매수의견|매도의견|컨센서스|어닝(?:쇼크|서프라이즈|콜)|턴어라운드|밸류에이션)/.source,
  /(증권사|애널리스트|증권가|상반기 전망|하반기 전망|호실적|어닝)/.source,
  /(\d+분기|\dQ\d{2}|FY\d{2})\s*(?:실적|영업이익|매출|순이익)/.source,
].join("|"), "g");

// 🆕 Round 8 Expert 5: 헤드라인 차단 패턴 — 증권 보고서 / 시황 / 공시 스타일.
const HEADLINE_TITLE_BLOCKLIST = [
  /[가-힣]{1,4}[證증권]\s*['"'"'`]/,                    // 신한證 ', 미래에셋'
  /['"'"'`][^'"'"'`]+,\s*(올해|내년|상반기|하반기|[1-4]Q|\d분기)/, // '지슨, 올해 상반기'
  /목표주가|투자의견|매수의견|비중확대|underweight|overweight/i,
  /턴어라운드|어닝서프라이즈|어닝쇼크|컨센서스/,
  /^\[(공시|특징주|시황|마감시황)\]/,
  /(상승|하락|급등|급락)\s*마감/,
  /실적\s*(호조|부진|개선|악화)/,
];

function isBlockedHeadlineTitle(title) {
  if (!title) return false;
  return HEADLINE_TITLE_BLOCKLIST.some((re) => re.test(title));
}

// 🆕 Round 8 Expert 5: 헤드라인 후보 = Tier 1 IT 전용 매체만.
// yna_it/etnews/ddaily 같은 일반 미디어는 헤드라인 후보에서 제외.
const HEADLINE_TIER1_SOURCES = new Set([
  // 1차 보도 IT 사업자 발표
  "openai", "anthropic", "google_ai", "meta_ai", "hf_blog",
  "deepmind", "mistral_ai", "stability_ai",
  // 메이저 글로벌 IT 미디어
  "mit_tech_review", "ieee_spectrum", "arstechnica",
  "techcrunch", "theverge", "wired",
  "venturebeat", "theinformation", "404media",
  "register", "tnw", "tomshardware", "techradar", "newstack", "infoq", "siliconangle",
  "zdnet", "cnet", "gizmodo",
  // DevTools 블로그
  "vercel", "supabase", "github_blog", "cloudflare", "netlify",
  "stripe", "render", "stripe_eng",
  // AX 매체
  "pragmatic_eng", "leaddev", "honeycomb", "shopify_eng", "github_eng",
  "netflix_tech", "uber_eng",
  // 학술
  "arxiv_cs_ai", "arxiv_cs_lg", "arxiv_cs_cl",
  // 한국 IT 전용 (Round 8: 추가)
  "bloter", "byline_kr", "itworld_kr", "zdnet_kr",
  "techm", "aitimes", "digitaltoday", "itchosun",
  "thelec", "toss_tech", "naver_d2", "kakao_tech", "woowa_tech",
  // 🌏 Round 9: 세계 IT 10대 강국 (헤드라인 후보 자격)
  "cn_36kr", "cn_pingwest", "cn_ifanr", "cn_geekpark", "cn_huxiu", "cn_itzhi",
  "jp_itmedia", "jp_gigazine", "jp_ascii", "jp_pcwatch", "jp_publickey",
  "de_heise", "de_golem", "de_computerwoche",
  "in_yourstory", "in_inc42", "in_analytics",
  "il_ctech", "il_globes",
  "tw_ithome", "tw_inside", "tw_techorange", "tw_digitimes",
  "fr_numerama", "fr_jdn", "fr_frenchweb",
  "ca_betakit", "ca_mobilesyrup",
]);

// 🆕 Round 8 Expert 2 (URL path signal): URL 경로로 IT/비IT 강한 신호.
// /tech/ /developer/ /ai/ — IT 보너스. /finance/ /stock/ /증시/ — 비IT 페널티.
function urlPathSignal(url) {
  if (!url) return 0;
  try {
    const u = new URL(url);
    const p = (u.pathname || "").toLowerCase();
    if (/\/(tech|developer|engineering|ai|ml|software|cloud|devops|opensource|it[\/\?])/i.test(p)) return 0.5;
    if (/\/(market|stock|finance|economy|business|money|invest|equity|증권|주식|금융|시황|증시)\//i.test(p)) return -0.6;
    if (/\/(politics|sports|entertainment|life|food|travel|culture|opinion|society)\//i.test(p)) return -0.5;
    return 0;
  } catch { return 0; }
}

// PERF Round 4 (Expert 2 Egorov): 5개 별도 regex 배열 → 결합된 단일 alternation regex.
// V8가 각 NFA 별도 traversal → 단일 amortize. /g 로 1-pass count.
// (각 패턴의 lookbehind/lookahead 미사용 패턴만 결합 — 안전.)
const IT_STRONG_RE = new RegExp(
  IT_KEYWORDS_STRONG.map((re) => re.source).join("|"),
  "gi"
);
const IT_MEDIUM_RE = new RegExp(
  IT_KEYWORDS_MEDIUM.map((re) => re.source).join("|"),
  "gi"
);
const IT_NEGATIVE_RE = new RegExp(
  IT_NEGATIVE_KEYWORDS.map((re) => re.source).join("|"),
  "gi"
);

function countMatches(text, re) {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count++;
  return count;
}

function scoreItRelevance(item) {
  const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`;
  if (!text.trim()) return 0;

  const strong = countMatches(text, IT_STRONG_RE);
  const medium = countMatches(text, IT_MEDIUM_RE);
  const negative = countMatches(text, IT_NEGATIVE_RE);
  // 🆕 Round 8 Expert 2: 한국 증권/금융 분석 보고서 패턴 — 강한 hard cap.
  IT_EQUITY_RE.lastIndex = 0;
  const equity = countMatches(text, IT_EQUITY_RE);
  // 🆕 Round 8 Expert 5: 헤드라인 차단 패턴 (제목 shape — 증권사 + 따옴표).
  const titleShapeBlock = isBlockedHeadlineTitle(item.title || "");
  // 🆕 Round 8 Expert 2: URL path 신호 (/tech/ vs /finance/).
  const urlSig = urlPathSignal(item.url || "");

  // 기본 source 권위
  const auth = SOURCE_AUTHORITY[item.source] || SOURCE_AUTHORITY._default;
  let base = 0;
  if (auth >= 4.5) base = 0.7;
  else if (auth >= 4.0) base = 0.5;
  else base = 0.3;

  let score = base + Math.min(0.4, strong * 0.12) + Math.min(0.2, medium * 0.05);
  score -= negative * 0.4;
  // 🆕 Round 8: equity 매칭 hard cap — 증권 보고서는 IT 키워드 누적되어도 0.35 이하.
  score -= equity * 0.6;
  if (urlSig !== 0) score += urlSig;
  if (titleShapeBlock) score = Math.min(score, 0.25);  // 제목 shape으로 차단 시 0.25 cap.
  if (equity >= 1 && strong < 3) score = Math.min(score, 0.35);
  if (item.domain === "oss") score = Math.max(score, 0.7);

  return clamp(round1(score), 0, 1.0);
}

// ── 4기준 채점 ─────────────────────────────────────────
// PERF Round 4 (Expert 2+8): scoreImpact는 pre-computed relevance를 받아 dedup.
// 기존: scoreImpact 내부에서 scoreItRelevance 호출 + shapeForDashboard 에서 또 호출 = 2번 = 2N×34 regex.
// 개선: main loop에서 1번 계산 → scoreImpact / shapeForDashboard 모두에 전달.
function scoreImpact(item, precomputedRel) {
  // 1) 소스 권위
  const auth = SOURCE_AUTHORITY[item.source] || SOURCE_AUTHORITY._default;
  // 2) 키워드 가중치 — pre-lowercased IMPACT_KW_LC 사용
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  let kw = 0;
  for (let i = 0; i < IMPACT_KW_LC.length; i++) {
    const [k, w] = IMPACT_KW_LC[i];
    if (text.includes(k)) kw += w;
  }
  kw = Math.min(2.0, kw);
  // 3) HN high-points 보너스
  let popBoost = 0;
  if (item.source === "hackernews" && item.points) {
    if (item.points >= 1000) popBoost = 1.0;
    else if (item.points >= 500) popBoost = 0.6;
    else if (item.points >= 200) popBoost = 0.3;
  }
  // 4) IT relevance — pre-computed (main loop에서 1번만 계산, dedup)
  const rel = (precomputedRel != null) ? precomputedRel : scoreItRelevance(item);
  // 5) 결합 — auth(0..5) + (kw + popBoost)(0..3). relevance multiplier 비-IT 강한 페널티.
  let raw = auth + (kw * 0.6) + (popBoost * 0.6);
  raw = raw * (0.4 + rel * 0.6);
  return clamp(round1(raw), 0, 5);
}

function scoreFreshness(item, windowHours) {
  if (!item.publishedAt) return 0;
  const parsed = Date.parse(item.publishedAt);
  if (isNaN(parsed)) return 0; // 파싱 실패는 데이터 오류 → 0
  const ageMs = Date.now() - parsed;
  if (ageMs < 0) return 5; // 미래 시각 = 최신으로 간주
  const ageHours = ageMs / 3_600_000;
  // 0h → 5점, windowHours → 1점, 그 이후 선형 0점까지
  const window = windowHours || 24;
  const ratio = Math.max(0, Math.min(1, ageHours / window));
  const score = 5 - ratio * 4; // 5..1
  // 윈도우 밖이면 빠르게 감소
  if (ageHours > window) {
    return clamp(round1(Math.max(0, 1 - (ageHours - window) / window)), 0, 5);
  }
  return clamp(round1(score), 0, 5);
}

function scoreDepth(item) {
  let score = 2.5; // 기본 중간
  const text = `${item.title || ""} ${item.summary || ""}`;
  // PERF Round 4: 5 별도 regex → 결합 DEPTH_REGEX 1-pass count
  const matches = countMatches(text, DEPTH_REGEX);
  score += Math.min(2, matches * 0.4);
  // 요약 길이 (긴 요약 = 더 깊은 콘텐츠로 가정)
  if (item.summary && item.summary.length > 200) score += 0.5;
  if (item.summary && item.summary.length > 400) score += 0.3;
  // 도메인 보너스
  if (item.domain === "oss") score += 0.5;
  if (item.domain === "community") score -= 0.2; // HN 댓글 위주
  return clamp(round1(score), 0, 5);
}

function scoreBuzz(item) {
  const points = item.points || 0;
  if (points <= 0) return 1.5;
  // log scale: 10 → 2.5, 100 → 3.5, 1000 → 4.3, 10000 → 5
  const score = Math.min(5, 1.5 + Math.log10(points + 1));
  return clamp(round1(score), 0, 5);
}

// ── 항목 형태 변환 ──────────────────────────────────────
// PERF Round 4: precomputedRel을 받아 scoreItRelevance 중복 호출 제거.
function shapeForDashboard(item, scores, precomputedRel) {
  // Strip non-numeric fields the LLM path may have leaked into scores (e.g. category).
  // Keeps validate-data.js's `scores 0..5 number` invariant.
  const numericScores = {
    impact:    scores && typeof scores.impact === "number"    ? scores.impact    : 0,
    freshness: scores && typeof scores.freshness === "number" ? scores.freshness : 0,
    depth:     scores && typeof scores.depth === "number"     ? scores.depth     : 0,
    buzz:      scores && typeof scores.buzz === "number"      ? scores.buzz      : 0,
  };

  // domain별로 다른 출력 shape (today.js 의 news[]/community[]/oss[]에 맞춤)
  const base = {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    sourceLabel: item.sourceLabel,
    publishedAt: item.publishedAt,
  };
  if (item.domain === "news") {
    return {
      ...base,
      category: item.rawCategory || "ai", // fallback
      sourceCountry: item.sourceCountry,
      summary: item.summary,
      scores: numericScores,
      itRelevance: (precomputedRel != null) ? precomputedRel : scoreItRelevance(item), // 0..1 헤드라인 게이트, dedup
      tags: item.tags || [],
      featured: numericScores.impact + numericScores.freshness + numericScores.depth + numericScores.buzz >= 18,
      headline: false,
    };
  }
  if (item.domain === "community") {
    return {
      ...base,
      sourceColor: item.sourceColor,
      points: item.points,
      relativeTime: relativeTime(item.publishedAt),
      category: item.rawCategory || "ai",
      author: item.author || "",
    };
  }
  if (item.domain === "oss") {
    const ossType = detectOssType(item);
    return {
      ...base,
      type: ossType,
      typeLabel: capitalize(ossType),
      typeIcon: ossTypeIcon(ossType),
      name: item.title, // GitHub repo name
      description: item.summary,
      stars: item.points,
      starsThisWeek: item.starsThisWeek || item.points,
      language: item.language || null,
      license: item.license || null,
      isKorean: !!item.isKorean,
      isTrending: !!item.isTrending,
      contributors: item.contributors || null,
    };
  }
  return base;
}

// 🆕 Round 9: OSS 타입 감지 확장 — security/database/devops/web/mobile/data 추가.
// 우선순위: 더 구체적인 분류부터.
function detectOssType(item) {
  const t = `${item.title} ${item.summary}`.toLowerCase();
  if (/\b(security|cve|vulnerab|cryptograph|firewall|ids|ips|wireshark|metasploit|nmap|burpsuite|owasp)\b/.test(t)) return "security";
  if (/\b(database|postgres|mysql|sqlite|mongodb|redis|cassandra|dynamodb|orm|prisma|drizzle|sqlx|sqlalchemy)\b/.test(t)) return "database";
  if (/\b(kubernetes|docker|container|terraform|ansible|jenkins|argo|helm|istio|envoy|prometheus|grafana|devops|ci\/cd|gitops|sre)\b/.test(t)) return "devops";
  if (/\b(react|vue|svelte|angular|next\.?js|remix|astro|solid|qwik|tailwind|css|html|web component|frontend|browser)\b/.test(t)) return "web";
  if (/\b(android|ios|flutter|react native|swift|kotlin|mobile app|jetpack compose|swiftui)\b/.test(t)) return "mobile";
  if (/\b(data (?:pipeline|engineering|stack|lake)|etl|elt|airflow|dbt|spark|kafka|iceberg|duckdb|polars|pandas|jupyter|analytics|bi tool)\b/.test(t)) return "data";
  if (/\bagent\b/.test(t))      return "agent";
  if (/\b(framework|toolkit)\b/.test(t))  return "framework";
  if (/\blibrary\b/.test(t))    return "library";
  if (/\b(model|llm|gpt|diffusion|transformer)\b/.test(t)) return "model";
  if (/\bdataset\b/.test(t))    return "dataset";
  if (/\b(runtime|engine|interpreter|compiler|vm)\b/.test(t))    return "runtime";
  return "tool";
}

function ossTypeIcon(type) {
  return {
    agent: "🤖", framework: "🏗", library: "📚", tool: "🔧",
    runtime: "⚡", model: "🧠", dataset: "📊",
    // Round 9 신규 아이콘
    security: "🔒", database: "🗄", devops: "☸️",
    web: "🌐", mobile: "📱", data: "📈",
  }[type] || "📦";
}

function relativeTime(iso) {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (isNaN(ms) || ms < 0) return "방금 전";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

// ── LLM 보강 (선택) ────────────────────────────────────
// LLM does NOT see publishedAt or points → it cannot compute freshness or buzz.
// We ONLY let it refine impact (industry/decision relevance) and depth (technical
// substance). Heuristic freshness/buzz stay authoritative. The LLM may also propose
// a category. Closes correctness P2 #17.
//
// Reliability: 30s AbortController timeout (was unbounded), bounded prompt-injection
// surface via XML-style delimiters (closes security P3 SEC-3).
async function llmRefine(item, baseScores) {
  if (!process.env.ANTHROPIC_API_KEY) return baseScores;
  const prompt = `Daily News 4기준 채점. impact + depth 만 0..5 실수로, category는 enum 1개. JSON만 출력. 추가 텍스트/markdown fence 금지.

<title>${(item.title || "").slice(0, 200)}</title>
<summary>${(item.summary || "").slice(0, 500)}</summary>
<source>${item.sourceLabel || item.source || ""}</source>

{ "impact": x, "depth": x, "category": "ai|devtools|ax|robotics|display|design|papers|standards|telecom" }`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        temperature: 0,   // deterministic re-runs for same input
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const text = (json.content && json.content[0] && json.content[0].text) || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return baseScores;
    const parsed = JSON.parse(m[0]);
    // Only let LLM move impact/depth. Freshness/buzz stay authoritative since
    // LLM has no time/points data. category propagates separately to rawCategory
    // ONLY if it's in the spec § 9 whitelist. Otherwise drop — closes
    // adversarial ADV-1 (prompt-injection sneaking arbitrary category through
    // XML delimiters, breaking the validate gate downstream).
    const safeCategory = typeof parsed.category === "string" && CATEGORY_SET.has(parsed.category)
      ? parsed.category
      : undefined;
    return {
      impact:    clamp(round1(parsed.impact ?? baseScores.impact), 0, 5),
      freshness: baseScores.freshness,
      depth:     clamp(round1(parsed.depth ?? baseScores.depth), 0, 5),
      buzz:      baseScores.buzz,
      category:  safeCategory,
    };
  } catch {
    return baseScores;
  } finally {
    clearTimeout(timer);
  }
}

// ── 유틸 ──────────────────────────────────────────────
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function round1(n) { return Math.round(n * 10) / 10; }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }

// ── 메인 ──────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.in)) {
    console.error(`✖ input not found: ${args.in}`);
    process.exit(1);
  }
  const t0 = Date.now();
  const raw = JSON.parse(fs.readFileSync(args.in, "utf8"));
  const items = raw.items || [];
  // Honor windowHours from raw (collect.js writes it). CLI --hours overrides if explicit.
  // Closes correctness P2 #16: collect.js --hours forwarding through to freshness scoring.
  const windowHours = (raw.windowHours && Number.isFinite(raw.windowHours))
    ? raw.windowHours
    : args.windowHours;

  // PERF Round 4 (Expert 6 Joyee + Expert 8 Caswell):
  // scoreItRelevance를 main loop에서 1번 계산 → scoreImpact / shapeForDashboard 모두에 전달.
  // 이전: scoreImpact 내부 1회 + shapeForDashboard 내부 1회 = 2N×34 regex.
  // 이후: 1회 = N×34 regex (50% 절감).
  const news = [], community = [], oss = [];
  for (const item of items) {
    const rel = scoreItRelevance(item);
    const baseScores = {
      impact:    scoreImpact(item, rel),
      freshness: scoreFreshness(item, windowHours),
      depth:     scoreDepth(item),
      buzz:      scoreBuzz(item),
    };
    let scores = baseScores;
    if (args.llm) {
      const refined = await llmRefine(item, baseScores);
      scores = refined;
      if (refined.category && !item.rawCategory) item.rawCategory = refined.category;
    }
    const shaped = shapeForDashboard(item, scores, rel);
    if (item.domain === "news")      news.push(shaped);
    else if (item.domain === "community") community.push(shaped);
    else if (item.domain === "oss")  oss.push(shaped);
  }

  // ── headline 선정 강화 ────────────────────────────────
  // 이전: impact + freshness 단순 합 1위. 점수 낮아도 무조건 headline.
  // 개선:
  //   1) 최소 임계 — 종합 점수 ≥ 4.0 (4기준 평균). 미달이면 headline 없이
  //      build-today.js가 fallback ("오늘 주요 이슈가 약합니다") 처리.
  //   2) 가중 — impact 50% + freshness 25% + buzz 15% + depth 10%.
  //      impact가 헤드라인의 본질, buzz가 cross-source 검증, depth는 보조.
  //   3) tie-break — 점수 동률 시 더 신뢰할 수 있는 source (1차 보도) 우선.
  //   4) Same-source 다수일 때 — sourceDiversity를 위해 다른 source 우선 가능
  //      (현재는 우선 점수만, 추후 확장)
  function headlineScore(n) {
    const s = n.scores || {};
    return (Number(s.impact || 0)) * 0.50
         + (Number(s.freshness || 0)) * 0.25
         + (Number(s.buzz || 0)) * 0.15
         + (Number(s.depth || 0)) * 0.10;
  }
  function avgOf(s) {
    return (Number(s.impact || 0) + Number(s.freshness || 0) + Number(s.depth || 0) + Number(s.buzz || 0)) / 4;
  }
  if (news.length) {
    // 🆕 Round 9: 사용자 요청 "헤드라인은 IT 관련 + 종합 점수 가장 높은 것".
    // 절대적 점수 임계는 제거. 핵심 게이트:
    //   1) IT relevance ≥ 0.6 (확실한 IT)
    //   2) HEADLINE_TIER1_SOURCES allowlist (yna_it 등 일반 미디어 제외)
    //   3) isBlockedHeadlineTitle false (증권 보고서/시황 차단)
    // 이 게이트를 통과한 항목 중 종합 점수(headlineScore) 가장 높은 것 = 헤드라인.
    // 게이트 통과 항목이 없으면 relevance/source 완화한 fallback.
    function isItHeadlineCandidate(n) {
      if (n.itRelevance != null && n.itRelevance < 0.6) return false;
      if (!HEADLINE_TIER1_SOURCES.has(n.source)) return false;
      if (isBlockedHeadlineTitle(n.title)) return false;
      return true;
    }

    // 1차: 엄격 게이트 통과 항목 중 최고 점수
    const candidates = news.filter(isItHeadlineCandidate);
    if (candidates.length) {
      candidates.sort((a, b) => {
        const dh = headlineScore(b) - headlineScore(a);
        if (Math.abs(dh) > 0.01) return dh;
        const aa = SOURCE_AUTHORITY[a.source] || SOURCE_AUTHORITY._default;
        const ba = SOURCE_AUTHORITY[b.source] || SOURCE_AUTHORITY._default;
        return ba - aa;
      });
      candidates[0].headline = true;
    } else {
      // 2차 fallback: relevance만 ≥0.5, title blocklist는 유지, source allowlist 완화
      const relaxed = news.filter((n) =>
        (n.itRelevance == null || n.itRelevance >= 0.5) &&
        !isBlockedHeadlineTitle(n.title)
      );
      if (relaxed.length) {
        relaxed.sort((a, b) => headlineScore(b) - headlineScore(a));
        relaxed[0].headline = true;
      }
    }
    // 정렬: 헤드라인 우선, 그 다음 점수 순
    news.sort((a, b) => {
      if (a.headline && !b.headline) return -1;
      if (!a.headline && b.headline) return 1;
      const dh = headlineScore(b) - headlineScore(a);
      if (Math.abs(dh) > 0.01) return dh;
      const aa = SOURCE_AUTHORITY[a.source] || SOURCE_AUTHORITY._default;
      const ba = SOURCE_AUTHORITY[b.source] || SOURCE_AUTHORITY._default;
      return ba - aa;
    });
  }

  const out = {
    scoredAt: new Date().toISOString(),
    windowHours: args.windowHours,
    llm: args.llm,
    counts: { news: news.length, community: community.length, oss: oss.length },
    news, community, oss,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  // PERF Round 4 (Expert 6 Joyee + Expert 9 Bert): drop pretty-print.
  // 중간 산출물은 machine-only — 35-40% 사이즈 + 1.7-2.0× 직렬화 속도 절감.
  // DEBUG=1 환경변수일 때만 indent (사람이 diff 할 때).
  const indent = process.env.DEBUG ? 2 : 0;
  fs.writeFileSync(args.out, JSON.stringify(out, indent || undefined, indent || undefined));
  const dt = Date.now() - t0;
  console.log(`[score] wrote ${path.relative(process.cwd(), args.out)} · news ${news.length} / community ${community.length} / oss ${oss.length} · ${args.llm ? "llm" : "heuristic"} · ${dt}ms`);
}

if (require.main === module) main().catch((e) => { console.error(`[score] FAILED: ${e.message}`); process.exit(1); });

module.exports = {
  scoreImpact, scoreFreshness, scoreDepth, scoreBuzz,
  shapeForDashboard, detectOssType, SOURCE_AUTHORITY,
  llmRefine,    // exported for unit tests (mocked fetch)
  // 🆕 Round 8: 헤드라인 차단 정책 export (build-today.js + 테스트에서 재사용)
  isBlockedHeadlineTitle,
  HEADLINE_TIER1_SOURCES,
  scoreItRelevance,
};
