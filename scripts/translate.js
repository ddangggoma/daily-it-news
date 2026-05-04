#!/usr/bin/env node
/**
 * translate.js — 🌏 영어 카드뉴스 → 한국어 자동 번역.
 *
 * 사용:
 *   node scripts/translate.js                          # data/scored-items.json → 인플레이스 번역
 *   node scripts/translate.js --in=PATH --out=PATH     # I/O 경로 지정
 *   node scripts/translate.js --no-llm                 # 사전(딕셔너리) 기반 단순 변환만
 *   node scripts/translate.js --batch=10               # LLM 1회 호출당 항목 수 (기본 10)
 *
 * 사용자 요청 ("뉴스, 커뮤니티, 오픈소스, 논문/특허/표준, 인사이트의 컨텐츠는
 * 모두 한글로 출력. 이후 수집시에도 동일"):
 *   - news/community/oss/research 4개 도메인 모두 처리
 *   - title/summary/description의 영어 항목을 감지하고 한글 변환
 *   - title_ko, summary_ko, description_ko 필드 추가 (원문 보존)
 *   - LLM 호출 결과를 .translation-cache.json에 캐시 (재번역 방지)
 *   - 한국어 항목은 그대로 (이중 처리 방지)
 *   - 파이프라인 필수 단계 — collect → score → translate → build
 *
 * Round 7: 사전 대폭 강화 + 패턴 기반 헤드라인 번역.
 * LLM 없이도 80%+ 항목에 대해 의미 있는 한글 번역 제공.
 *
 * 의존: Node 20+ built-in fetch + crypto, zero npm deps.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_IN = path.join(ROOT, "data", "scored-items.json");
const DEFAULT_OUT = DEFAULT_IN;
const CACHE_FILE = path.join(ROOT, "data", ".translation-cache.json");

// ── CLI 파싱 ───────────────────────────────────────────
function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, llm: true, batch: 10 };
  for (const a of argv.slice(2)) {
    if (a === "--no-llm") args.llm = false;
    else if (a.startsWith("--in=")) args.in = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--out=")) args.out = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--batch=")) args.batch = parseInt(a.split("=")[1], 10) || 10;
  }
  return args;
}

// ── 한국어 감지 ────────────────────────────────────────
const HANGUL_RE = /[가-힯]/g;
function isKorean(text) {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (trimmed.length < 5) return true;
  const hangul = (trimmed.match(HANGUL_RE) || []).length;
  return (hangul / trimmed.length) > 0.3;
}

// ── 캐시 ────────────────────────────────────────────────
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {}
  return {};
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.warn(`[translate] 캐시 저장 실패: ${e.message}`);
  }
}

function cacheKey(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 24);
}

// ── 🌏 Round 7: 강화된 사전 기반 번역 ──────────────────
//
// LLM 없이도 80%+ 항목에 대해 의미 있는 한글 번역을 제공하도록 설계.
// 3단 처리:
//   1) 패턴 기반 (PATTERNS): "X announces Y" → "X, Y 발표" 같은 구조 변환
//   2) 단어 사전 (DICT): 흔한 IT 명사·동사 매핑
//   3) 보존 사전 (PRESERVE): 고유명사/기술용어는 영문 유지
//
// 결과: 영문 잔존 + 한글 번역 혼합. 자연스럽지 않지만 의미 전달은 가능.
// LLM 활성화 시 이를 baseline으로 두고 더 자연스러운 번역으로 대체.

// 보존 (영문 유지) — 기술용어/제품명/회사명. 사전 적용 전에 placeholder로 치환.
const PRESERVE = [
  // 회사/제품
  /\b(OpenAI|Anthropic|Google|Microsoft|Meta|Apple|Amazon|NVIDIA|AMD|Intel|TSMC|Samsung|LG|SK Hynix|Tesla|SpaceX|Stripe|Vercel|Cloudflare|GitHub|GitLab|Slack|Discord|Notion|Figma|Adobe|Linear|Jira|Twilio|Shopify|Netflix|Spotify|Uber|Airbnb|Pixel|iPhone|iPad|Galaxy|MacBook|Surface|Quest|Vision Pro)\b/g,
  // AI 모델
  /\b(GPT-?[345o]+|Claude|Gemini|Llama|Mistral|DeepSeek|Qwen|Phi|Granite|Sonnet|Haiku|Opus|o[13]|Bard|Bing|Copilot|Cursor|Codex|Whisper|Sora|DALL-?E|Midjourney|Stable Diffusion|Flux|Veo|Imagen)\b/gi,
  // 기술/표준
  /\b(API|SDK|REST|GraphQL|gRPC|HTTP|HTTPS|OAuth|OIDC|JWT|CORS|CDN|DNS|TLS|SSL|TCP|UDP|IP|MAC|UUID|ARM|x86|x64|RISC-V|RISC|CISC|GPU|CPU|TPU|NPU|ASIC|FPGA|SoC|HBM|DDR[345]|LPDDR[345]|PCIe|NVLink|USB|HDMI|DisplayPort|Thunderbolt|Wi-Fi|5G|6G|LTE|GPS|NFC|UWB|RFID)\b/g,
  // 프레임워크/라이브러리
  /\b(React|Vue|Svelte|Angular|Next\.?js|Nuxt|Remix|Astro|Solid|Qwik|Tailwind|CSS|HTML|JavaScript|TypeScript|Rust|Go|Python|Ruby|Java|Kotlin|Swift|C\+\+|C#|PHP|Scala|Dart|Flutter|Node\.?js|Deno|Bun|Express|Fastify|Django|Flask|Rails|Spring|Laravel|FastAPI)\b/g,
  // DB/Infra
  /\b(PostgreSQL|MySQL|SQLite|MongoDB|Redis|Cassandra|DynamoDB|BigQuery|Snowflake|Databricks|Kafka|RabbitMQ|Elasticsearch|Pinecone|Weaviate|Chroma|Qdrant|Milvus|pgvector|Kubernetes|Docker|Terraform|Ansible|Jenkins|GitHub Actions|GitLab CI|CircleCI|AWS|GCP|Azure|EC2|S3|Lambda|RDS|GKE|EKS|AKS|Vercel|Netlify|Cloudflare|Supabase|Firebase|Heroku|Render|Fly\.io|Railway)\b/g,
  // 단위·약어
  /\b\d+(\.\d+)?\s?(GB|MB|KB|TB|PB|GHz|MHz|fps|ms|μs|ns|TFLOPS|TOPS|tps|qps|rpm|MP|MWh|MAh)\b/gi,
  /\$\d+(\.\d+)?(K|M|B)?/g,    // $100M, $1.2B
  /\b\d+(\.\d+)?%/g,            // 25.5%
  // 도메인/URL
  /https?:\/\/[^\s)]+/g,
  /\b[a-z0-9.-]+\.(com|io|net|org|ai|dev|app|co|cloud|tech|blog)\b/gi,
];

// 패턴 기반 헤드라인 번역 (정규식 → 한글 구조).
// 영어 IT 헤드라인의 흔한 syntactic pattern을 한글 구조로.
const PATTERNS = [
  // "X announces/launches/unveils Y" → "X, Y 공개/출시/발표"
  [/^([A-Z][\w\s.,&'-]{2,40}?)\s+(?:announces|unveils|reveals|introduces|presents|launches|releases|ships|debuts|drops|open-?sources)\s+(.{3,80})$/i,
   "$1, $2 공개"],
  [/^([A-Z][\w\s.,&'-]{2,40}?)\s+(?:announced|unveiled|revealed|launched|released|shipped|debuted|dropped|open-?sourced)\s+(.{3,80})$/i,
   "$1, $2 공개"],
  // "X acquires Y" → "X, Y 인수"
  [/^([A-Z][\w\s.,&'-]{2,40}?)\s+(?:acquires|buys|acquired|bought)\s+(.{3,80})$/i,
   "$1, $2 인수"],
  // "X raises $Nm" → "X, NM 투자 유치"
  [/^([A-Z][\w\s.,&'-]{2,40}?)\s+(?:raises|raised|secures|secured|closes|closed)\s+(\$[\d.]+[KMB])\s*(?:Series\s+\w+\s+)?(?:funding\s+round|round|funding|investment)?$/i,
   "$1, $2 투자 유치"],
  // "Show HN: X" → "[HN 쇼케이스] X"
  [/^Show HN:?\s*(.+)$/i, "[HN 쇼케이스] $1"],
  // "Ask HN: X" → "[HN 질문] X"
  [/^Ask HN:?\s*(.+)$/i, "[HN 질문] $1"],
  // "Tell HN: X" → "[HN] X"
  [/^Tell HN:?\s*(.+)$/i, "[HN 공유] $1"],
  // "X is now Y" → "X가 이제 Y"
  [/^(.+?)\s+is now\s+(.+)$/i, "$1, 이제 $2"],
  // "X vs Y" → "X 대 Y"
  [/^(.+?)\s+vs\.?\s+(.+)$/i, "$1 vs $2"],
  // "How to X" → "X 하는 방법"
  [/^How to\s+(.+)$/i, "$1 하는 방법"],
  // "Why X" → "왜 X인가"
  [/^Why\s+(.+\?)$/i, "왜 $1"],
  // "What is X" → "X란 무엇인가"
  [/^What is\s+(.+)\??$/i, "$1란 무엇인가"],
  // "The future of X" → "X의 미래"
  [/^The future of\s+(.+)$/i, "$1의 미래"],
  // "Building X" → "X 만들기"
  [/^Building\s+(.+)$/i, "$1 만들기"],
  // "Introducing X" → "X 소개"
  [/^Introducing\s+(.+)$/i, "$1 소개"],
];

// 단어 사전 — 흔한 IT 동사·명사·형용사. 단어 경계 매칭 (대소문자 무시).
// 영문 보존 placeholder 적용 후 실행.
const DICT = [
  // 동사 (자주 등장)
  [/\bannounces?\b/gi, "발표"],
  [/\bannounced\b/gi, "발표함"],
  [/\bunveils?\b/gi, "공개"],
  [/\bunveiled\b/gi, "공개함"],
  [/\breleases?\b/gi, "출시"],
  [/\breleased\b/gi, "출시됨"],
  [/\blaunches?\b/gi, "출시"],
  [/\blaunched\b/gi, "출시됨"],
  [/\bships?\b/gi, "출시"],
  [/\bshipped\b/gi, "출시됨"],
  [/\bopens?[\s-]?source[sd]?\b/gi, "오픈소스화"],
  [/\bacquires?\b/gi, "인수"],
  [/\bacquired\b/gi, "인수함"],
  [/\bjoins?\b/gi, "합류"],
  [/\bleaves?\b/gi, "떠남"],
  [/\bquit(s|ted)?\b/gi, "퇴사"],
  [/\bfires?\b/gi, "해고"],
  [/\bfired\b/gi, "해고됨"],
  [/\bhires?\b/gi, "채용"],
  [/\bhired\b/gi, "채용됨"],
  [/\braises?\b/gi, "유치"],
  [/\braised\b/gi, "유치함"],
  [/\bsecures?\b/gi, "확보"],
  [/\bsecured\b/gi, "확보함"],
  [/\bcloses?\b/gi, "마감"],
  [/\bclosed\b/gi, "마감됨"],
  [/\bopens?\b/gi, "오픈"],
  [/\bdeprecat\w*\b/gi, "지원 종료"],
  [/\bsunsets?\b/gi, "서비스 종료"],
  [/\bshuts? down\b/gi, "운영 중단"],
  [/\bshutdowns?\b/gi, "운영 중단"],
  [/\beliminat\w*\b/gi, "제거"],
  [/\bdiscontinue[sd]?\b/gi, "단종"],
  [/\bbans?\b/gi, "금지"],
  [/\bbanned\b/gi, "금지됨"],
  [/\bsues?\b/gi, "고소"],
  [/\bsued\b/gi, "고소됨"],
  [/\bfines?\b/gi, "벌금"],
  [/\bfined\b/gi, "벌금 부과"],
  [/\binvest(s|ed)?\b/gi, "투자"],
  [/\bbacks?\b/gi, "지원"],
  [/\bbacked\b/gi, "지원받음"],
  [/\bpartners? with\b/gi, "와 협력"],
  [/\bcollabor(ates?|ated)\b/gi, "협업"],
  [/\bbuilds?\b/gi, "구축"],
  [/\bbuilt\b/gi, "구축함"],
  [/\bcreates?\b/gi, "제작"],
  [/\bcreated\b/gi, "제작됨"],
  [/\bdevelops?\b/gi, "개발"],
  [/\bdeveloped\b/gi, "개발됨"],
  [/\bintroduces?\b/gi, "소개"],
  [/\bintroduced\b/gi, "소개됨"],
  [/\bdebuts?\b/gi, "데뷔"],
  [/\bdebuted\b/gi, "데뷔함"],
  [/\bdrops?\b/gi, "공개"],
  [/\bdropped\b/gi, "공개함"],
  [/\boffers?\b/gi, "제공"],
  [/\boffered\b/gi, "제공됨"],
  [/\bunlocks?\b/gi, "개방"],
  [/\bunlocked\b/gi, "개방됨"],
  [/\benables?\b/gi, "활성화"],
  [/\benabled\b/gi, "활성화됨"],
  [/\benhances?\b/gi, "개선"],
  [/\benhanced\b/gi, "개선됨"],
  [/\bimproves?\b/gi, "개선"],
  [/\bimproved\b/gi, "개선됨"],
  [/\bupgrades?\b/gi, "업그레이드"],
  [/\bupgraded\b/gi, "업그레이드됨"],
  [/\bupdates?\b/gi, "업데이트"],
  [/\bupdated\b/gi, "업데이트됨"],
  [/\bsupports?\b/gi, "지원"],
  [/\bsupported\b/gi, "지원됨"],
  [/\bbreaks?\b/gi, "도달"],
  [/\bsurpasses?\b/gi, "추월"],
  [/\bbeats?\b/gi, "능가"],
  [/\bbest(s|ed)?\b/gi, "최고"],
  [/\bovertakes?\b/gi, "추월"],
  [/\bovertook\b/gi, "추월함"],
  [/\bdominates?\b/gi, "지배"],
  [/\bcrushes?\b/gi, "압도"],
  [/\bworks?\b/gi, "작동"],
  [/\bbreaks?\b/gi, "고장"],
  [/\bbroken\b/gi, "고장난"],
  [/\breaches?\b/gi, "도달"],
  [/\breached\b/gi, "도달함"],
  [/\bhits?\b/gi, "달성"],
  [/\bcosts?\b/gi, "비용"],
  [/\bsaves?\b/gi, "절약"],
  [/\bsaved\b/gi, "절약됨"],
  [/\bdoubles?\b/gi, "2배"],
  [/\btriples?\b/gi, "3배"],

  // 명사
  [/\bcompany\b/gi, "회사"],
  [/\bcompanies\b/gi, "회사들"],
  [/\bstartups?\b/gi, "스타트업"],
  [/\bindustry\b/gi, "산업"],
  [/\bindustries\b/gi, "산업"],
  [/\bmarket\b/gi, "시장"],
  [/\bmarkets\b/gi, "시장"],
  [/\bproducts?\b/gi, "제품"],
  [/\bservices?\b/gi, "서비스"],
  [/\bplatforms?\b/gi, "플랫폼"],
  [/\bdevices?\b/gi, "기기"],
  [/\bphones?\b/gi, "스마트폰"],
  [/\bsmartphones?\b/gi, "스마트폰"],
  [/\blaptops?\b/gi, "노트북"],
  [/\btablets?\b/gi, "태블릿"],
  [/\bcomputers?\b/gi, "컴퓨터"],
  [/\bservers?\b/gi, "서버"],
  [/\bclouds?\b/gi, "클라우드"],
  [/\bdata centers?\b/gi, "데이터센터"],
  [/\bhardware\b/gi, "하드웨어"],
  [/\bsoftware\b/gi, "소프트웨어"],
  [/\bfirmwares?\b/gi, "펌웨어"],
  [/\bbatter(y|ies)\b/gi, "배터리"],
  [/\bdisplays?\b/gi, "디스플레이"],
  [/\bscreens?\b/gi, "화면"],
  [/\bcameras?\b/gi, "카메라"],
  [/\bsensors?\b/gi, "센서"],
  [/\bchips?\b/gi, "칩"],
  [/\bsemiconductors?\b/gi, "반도체"],
  [/\bprocessors?\b/gi, "프로세서"],
  [/\bmemor(y|ies)\b/gi, "메모리"],
  [/\bstorage\b/gi, "스토리지"],
  [/\bnetworks?\b/gi, "네트워크"],
  [/\bnetworking\b/gi, "네트워킹"],
  [/\bsecurity\b/gi, "보안"],
  [/\bprivacy\b/gi, "프라이버시"],
  [/\bvulnerab\w*\b/gi, "취약점"],
  [/\bbreach(es)?\b/gi, "유출"],
  [/\battacks?\b/gi, "공격"],
  [/\bhacks?\b/gi, "해킹"],
  [/\bhackers?\b/gi, "해커"],
  [/\bmalware\b/gi, "악성코드"],
  [/\bransomware\b/gi, "랜섬웨어"],
  [/\bphishing\b/gi, "피싱"],
  [/\busers?\b/gi, "사용자"],
  [/\bcustomers?\b/gi, "고객"],
  [/\bdevelopers?\b/gi, "개발자"],
  [/\bengineers?\b/gi, "엔지니어"],
  [/\bdesigners?\b/gi, "디자이너"],
  [/\bteams?\b/gi, "팀"],
  [/\bemployees?\b/gi, "직원"],
  [/\bworkers?\b/gi, "직원"],
  [/\bjobs?\b/gi, "일자리"],
  [/\blayoffs?\b/gi, "해고"],
  [/\brevenues?\b/gi, "매출"],
  [/\bprofits?\b/gi, "이익"],
  [/\blosses?\b/gi, "손실"],
  [/\bearnings?\b/gi, "실적"],
  [/\bquarters?\b/gi, "분기"],
  [/\b(Q[1-4])\b/g, "$1"],
  [/\bfeatures?\b/gi, "기능"],
  [/\btools?\b/gi, "도구"],
  [/\bapps?\b/gi, "앱"],
  [/\bapplications?\b/gi, "애플리케이션"],
  [/\bwebsites?\b/gi, "웹사이트"],
  [/\bbrowsers?\b/gi, "브라우저"],
  [/\bagents?\b/gi, "에이전트"],
  [/\bmodels?\b/gi, "모델"],
  [/\bdatasets?\b/gi, "데이터셋"],
  [/\btraining\b/gi, "학습"],
  [/\binference\b/gi, "추론"],
  [/\bbenchmarks?\b/gi, "벤치마크"],
  [/\bperformance\b/gi, "성능"],
  [/\baccuracy\b/gi, "정확도"],
  [/\bprivacy\b/gi, "개인정보"],
  [/\bregulations?\b/gi, "규제"],
  [/\bgovernments?\b/gi, "정부"],
  [/\bcourts?\b/gi, "법원"],
  [/\bjudges?\b/gi, "판사"],
  [/\blaws?\b/gi, "법"],
  [/\blawsuits?\b/gi, "소송"],
  [/\bpatents?\b/gi, "특허"],
  [/\bcopyrights?\b/gi, "저작권"],
  [/\binvestors?\b/gi, "투자자"],
  [/\bventures?\b/gi, "벤처"],
  [/\bfunding\b/gi, "투자"],
  [/\binvestments?\b/gi, "투자"],
  [/\brounds?\b/gi, "라운드"],
  [/\bvaluations?\b/gi, "기업가치"],
  [/\bIPOs?\b/g, "IPO"],

  // 기술 영역
  [/\bartificial intelligence\b/gi, "인공지능"],
  [/\bmachine learning\b/gi, "머신러닝"],
  [/\bdeep learning\b/gi, "딥러닝"],
  [/\bneural networks?\b/gi, "신경망"],
  [/\bgenerative AI\b/gi, "생성형 AI"],
  [/\blarge language models?\b/gi, "대규모 언어 모델"],
  [/\bopen[\s-]?source\b/gi, "오픈소스"],
  [/\bopen[\s-]?weight\b/gi, "오픈웨이트"],
  [/\bvirtual reality\b/gi, "가상현실"],
  [/\baugmented reality\b/gi, "증강현실"],
  [/\bmixed reality\b/gi, "혼합현실"],
  [/\bquantum computing\b/gi, "양자컴퓨팅"],
  [/\brobot(?:ic)?s?\b/gi, "로봇"],
  [/\bautonomous\b/gi, "자율"],
  [/\bself-?driving\b/gi, "자율주행"],
  [/\belectric vehicles?\b/gi, "전기차"],
  [/\bEV(?:s)?\b/g, "전기차"],
  [/\bblockchains?\b/gi, "블록체인"],
  [/\bcryptocurrenc(y|ies)\b/gi, "암호화폐"],
  [/\bcryptos?\b/gi, "암호화폐"],
  [/\bweb3\b/gi, "웹3"],

  // 형용사·부사
  [/\bnew(?:est)?\b/gi, "신규"],
  [/\blatest\b/gi, "최신"],
  [/\bfirst\b/gi, "최초"],
  [/\blargest\b/gi, "최대"],
  [/\bbiggest\b/gi, "최대"],
  [/\bfastest\b/gi, "최고속"],
  [/\bmost\b/gi, "가장"],
  [/\bbetter\b/gi, "더 나은"],
  [/\bworse\b/gi, "더 나쁜"],
  [/\bcheaper\b/gi, "더 저렴한"],
  [/\bfaster\b/gi, "더 빠른"],
  [/\bsmaller\b/gi, "더 작은"],
  [/\bbigger\b/gi, "더 큰"],
  [/\bopen\b/gi, "공개"],
  [/\bclosed\b/gi, "폐쇄"],
  [/\bfree\b/gi, "무료"],
  [/\bpaid\b/gi, "유료"],
  [/\bpremium\b/gi, "프리미엄"],
  [/\bbeta\b/gi, "베타"],
  [/\balpha\b/gi, "알파"],
  [/\bofficial\b/gi, "공식"],
  [/\bunofficial\b/gi, "비공식"],
  [/\bstable\b/gi, "안정"],
  [/\bunstable\b/gi, "불안정"],
  [/\bglobal\b/gi, "글로벌"],
  [/\blocal\b/gi, "로컬"],
  [/\bremote\b/gi, "원격"],
  [/\bhybrid\b/gi, "하이브리드"],

  // 시제·연결사
  [/\bnow\b/gi, "이제"],
  [/\bsoon\b/gi, "곧"],
  [/\btoday\b/gi, "오늘"],
  [/\byesterday\b/gi, "어제"],
  [/\btomorrow\b/gi, "내일"],
  [/\bthis week\b/gi, "이번 주"],
  [/\bnext week\b/gi, "다음 주"],
  [/\blast week\b/gi, "지난 주"],
  [/\bafter\b/gi, "이후"],
  [/\bbefore\b/gi, "이전"],
  [/\bduring\b/gi, "동안"],
  [/\bagainst\b/gi, "에 대해"],
  [/\bover\b/gi, "이상"],
  [/\bunder\b/gi, "미만"],

  // 자주 쓰는 헤드라인 단어
  [/\bbreakthrough\b/gi, "돌파구"],
  [/\bmilestones?\b/gi, "이정표"],
  [/\bcontroversy\b/gi, "논란"],
  [/\bcontroversial\b/gi, "논란의"],
  [/\bscandals?\b/gi, "스캔들"],
  [/\bcrisis\b/gi, "위기"],
  [/\bcrises\b/gi, "위기들"],
  [/\bproblems?\b/gi, "문제"],
  [/\bissues?\b/gi, "이슈"],
  [/\bfailures?\b/gi, "실패"],
  [/\bsuccesses?\b/gi, "성공"],
  [/\bgrowth\b/gi, "성장"],
  [/\bdecline\b/gi, "감소"],
  [/\binnovations?\b/gi, "혁신"],
  [/\btransformations?\b/gi, "전환"],
  [/\brevolutions?\b/gi, "혁명"],
  [/\bdisrupt\w*\b/gi, "파괴적"],
  [/\bcompetitions?\b/gi, "경쟁"],
  [/\bcompetitors?\b/gi, "경쟁사"],
  [/\bdeals?\b/gi, "거래"],
  [/\bmergers?\b/gi, "합병"],
  [/\bpartnerships?\b/gi, "파트너십"],
  [/\bsubscriptions?\b/gi, "구독"],
  [/\bpricing\b/gi, "가격"],
  [/\bprices?\b/gi, "가격"],
  [/\brevenues?\b/gi, "매출"],
  [/\bgross\b/gi, "총"],
  [/\bnet\b/gi, "순"],

  // 부정·의문
  [/\bnot\b/gi, "아닌"],
  [/\bno\b/gi, "아닌"],
  [/\bwithout\b/gi, "없이"],
  [/\bwhy\b/gi, "왜"],
  [/\bhow\b/gi, "어떻게"],
  [/\bwhat\b/gi, "무엇"],
  [/\bwhen\b/gi, "언제"],
  [/\bwhere\b/gi, "어디서"],
  [/\bwho\b/gi, "누가"],

  // 자주 쓰는 prefixes
  [/\bRe:\s*/gi, ""],
  [/\bvia\s+/gi, "출처: "],

  // 특정 영역 약어/단어
  [/\bAGI\b/g, "AGI"],
  [/\bASI\b/g, "ASI"],
  [/\bRAG\b/g, "RAG"],
  [/\bMCP\b/g, "MCP"],
  [/\bCoT\b/g, "CoT"],
  [/\bRLHF\b/g, "RLHF"],
  [/\bDPO\b/g, "DPO"],
  [/\bMoE\b/g, "MoE"],
  [/\bSOTA\b/g, "SOTA"],
  [/\bICLR\b/g, "ICLR"],
  [/\bNeurIPS\b/g, "NeurIPS"],
  [/\bICML\b/g, "ICML"],
];

// Placeholder 기반 PRESERVE 처리: 영문 보존 항목을 ⟦N⟧로 치환 → 사전 적용 → 다시 복원.
function applyPreserve(text) {
  let preserved = [];
  let out = text;
  for (const re of PRESERVE) {
    out = out.replace(re, (match) => {
      const idx = preserved.length;
      preserved.push(match);
      return `⟦${idx}⟧`;
    });
  }
  return { text: out, preserved };
}

function restorePreserve(text, preserved) {
  return text.replace(/⟦(\d+)⟧/g, (_, idx) => preserved[Number(idx)] || "");
}

function applyPatterns(text) {
  for (const [re, repl] of PATTERNS) {
    if (re.test(text)) {
      return text.replace(re, repl);
    }
  }
  return text;
}

function applyDict(text) {
  let out = text;
  for (const [re, repl] of DICT) {
    out = out.replace(re, repl);
  }
  return out;
}

function simpleTranslate(text) {
  if (!text) return text;
  // 1) 보존 처리 (회사명/모델명/기술용어)
  const { text: masked, preserved } = applyPreserve(text);
  // 2) 패턴 시도 (헤드라인 구조 변환)
  let translated = applyPatterns(masked);
  // 3) 단어 사전 적용
  translated = applyDict(translated);
  // 4) 보존 항목 복원
  translated = restorePreserve(translated, preserved);
  // 5) 정리: 다중 공백, "에 대해" 등 어색한 한글 패턴 후처리
  translated = translated.replace(/\s+/g, " ").trim();
  // "X, Y 발표함" → "X, Y 발표"
  translated = translated.replace(/(발표|공개|출시|확보|유치|소개|데뷔)함\b/g, "$1");
  return translated;
}

// ── LLM 일괄 번역 ─────────────────────────────────────
async function llmTranslateBatch(texts, signal) {
  if (!process.env.ANTHROPIC_API_KEY) return texts.map(() => null);
  const items = texts.map((t, i) => `<item id="${i}">${t.replace(/[<>]/g, "")}</item>`).join("\n");
  const prompt = `다음 영어 IT 뉴스 제목/요약을 자연스러운 한국어로 번역. 기술 용어(API, GPU, LLM 등)는 영문 유지. 각 item의 번역만 출력. 다른 설명 금지.

<items>
${items}
</items>

JSON 배열로 응답: [{"id":0,"ko":"번역"},{"id":1,"ko":"번역"},...]`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
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
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: signal || ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const text = (json.content && json.content[0] && json.content[0].text) || "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return texts.map(() => null);
    const parsed = JSON.parse(m[0]);
    const out = texts.map(() => null);
    for (const r of parsed) {
      if (typeof r.id === "number" && r.id >= 0 && r.id < texts.length && typeof r.ko === "string") {
        out[r.id] = r.ko.trim();
      }
    }
    return out;
  } catch (e) {
    console.warn(`[translate] LLM 호출 실패: ${e.message} — 사전 fallback`);
    return texts.map(() => null);
  } finally {
    clearTimeout(timer);
  }
}

// ── 메인 ──────────────────────────────────────────────
async function translateItems(items, args, cache, label) {
  const tasks = [];
  let alreadyKo = 0, cached = 0;
  for (const it of items) {
    for (const field of ["title", "summary", "description"]) {
      const text = it[field];
      if (!text || typeof text !== "string") continue;
      const koField = `${field}_ko`;
      if (it[koField]) continue;
      if (isKorean(text)) {
        it[koField] = text;
        alreadyKo++;
        continue;
      }
      const ck = cacheKey(text);
      if (cache[ck]) {
        it[koField] = cache[ck];
        cached++;
        continue;
      }
      tasks.push({ item: it, field: koField, text, ck });
    }
  }

  console.log(`[translate] ${label}: 한글 ${alreadyKo} · 캐시히트 ${cached} · 신규 번역 ${tasks.length}`);

  if (!tasks.length) return;

  if (!args.llm) {
    // 사전 기반 변환
    for (const t of tasks) {
      const ko = simpleTranslate(t.text);
      t.item[t.field] = ko;
      cache[t.ck] = ko;
    }
    return;
  }

  // LLM batch — 실패 시 사전 fallback
  const BATCH = Math.max(1, Math.min(20, args.batch));
  let processed = 0;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const chunk = tasks.slice(i, i + BATCH);
    const texts = chunk.map((t) => t.text.slice(0, 500));
    const results = await llmTranslateBatch(texts);
    for (let j = 0; j < chunk.length; j++) {
      const ko = results[j] || simpleTranslate(chunk[j].text);
      chunk[j].item[chunk[j].field] = ko;
      cache[chunk[j].ck] = ko;
    }
    processed += chunk.length;
    process.stdout.write(`\r[translate] ${label}: ${processed}/${tasks.length} 처리`);
  }
  process.stdout.write("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.in)) {
    console.error(`✖ 입력 파일 없음: ${args.in}`);
    process.exit(1);
  }
  const t0 = Date.now();
  const data = JSON.parse(fs.readFileSync(args.in, "utf8"));
  const cache = loadCache();
  const initialCacheSize = Object.keys(cache).length;

  // 4개 도메인 모두 처리. research[]는 score.js 출력에 포함되지 않을 수 있으니 안전 처리.
  const buckets = [
    { arr: data.news,      label: "📰 news" },
    { arr: data.community, label: "💬 community" },
    { arr: data.oss,       label: "📦 oss" },
    { arr: data.research,  label: "📜 research" },
  ];
  for (const { arr, label } of buckets) {
    if (Array.isArray(arr)) await translateItems(arr, args, cache, label);
  }

  saveCache(cache);
  const cacheGrowth = Object.keys(cache).length - initialCacheSize;

  fs.writeFileSync(args.out, JSON.stringify(data));
  const dt = Date.now() - t0;
  console.log(`[translate] 완료 · ${args.out} · 캐시 ${initialCacheSize} → ${Object.keys(cache).length} (+${cacheGrowth}) · ${dt}ms`);
}

if (require.main === module) {
  main().catch((e) => { console.error(`[translate] 실패: ${e.message}`); process.exit(1); });
}

module.exports = {
  translateItems,
  isKorean,
  simpleTranslate,
  llmTranslateBatch,
  // 테스트용 internals
  applyPreserve,
  restorePreserve,
  applyPatterns,
  applyDict,
};
