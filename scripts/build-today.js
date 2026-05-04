#!/usr/bin/env node
/**
 * build-today.js — 일일 발행 파이프라인 마지막 단계.
 *
 * 사용:
 *   node scripts/build-today.js                       # data/scored-items.json → data/today.js
 *   node scripts/build-today.js --in=PATH --out=PATH  # I/O 경로 지정
 *   node scripts/build-today.js --no-validate         # validate-data.js 스킵
 *
 * 입력: scored-items.json (score.js 산출물)
 * 시드: data/today.template.js (quote, lead, influencers, insightTemplates)
 *       data/experts.js (10명 전문가)
 *
 * 출력: data/today.js (window.__DAILY__ = {...} 형식, 대시보드 직접 사용)
 *
 * 자동 생성 영역:
 *   - conclusion (headline + scoreAvg + vs7d)
 *   - counts, stats
 *   - fiveLines (점수 합 상위 5)
 *   - buckets (publishedAt 기반)
 *   - sourceDiversity (sourceCountry %)
 *   - news[], community[], oss[]
 *   - insights[] (각 전문가에게 top news 1개 매칭, 시드 분석 사용)
 *
 * 시드 영역:
 *   - quote, lead, influencers (today.template.js)
 *   - insights[i].analysis 본문 (LLM 통합 후 자동 생성)
 *
 * 마지막에 validate-data.js를 자동 실행 (--no-validate로 스킵 가능).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadBrowserGlobal } = require("./_io");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_IN  = path.join(ROOT, "data", "scored-items.json");
const DEFAULT_OUT = path.join(ROOT, "data", "today.js");
const TEMPLATE    = path.join(ROOT, "data", "today.template.js");
const EXPERTS     = path.join(ROOT, "data", "experts.js");
const VALIDATOR   = path.join(ROOT, "scripts", "validate-data.js");

// ── CLI ────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, validate: true };
  for (const a of argv.slice(2)) {
    if (a === "--no-validate") args.validate = false;
    else if (a.startsWith("--in=")) args.in = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--out=")) args.out = path.resolve(a.split("=")[1]);
  }
  return args;
}

// ── 시드 / 데이터 로드 ─────────────────────────────────
// 의도적 분리: 파일 부재(=optional seed)는 정상 fallback;
// 파일 존재하지만 평가 실패(SyntaxError/ReferenceError)는 fatal.
// 후자를 silent로 흘려보내면 quote/lead/influencers/insights가 silent로
// 빈값 fallback이 되어 dashboard가 빈 hero로 발행됨 (closes ADV-2).
function loadGlobal(file, key) {
  if (!fs.existsSync(file)) return null;        // missing = OK (optional)
  try { return loadBrowserGlobal(file, key); }   // throws on parse error
  catch (err) {
    console.error(`[build-today] ✖ ${path.basename(file)} 평가 실패: ${err.message}`);
    throw err;                                   // fatal — exit 1 propagates
  }
}

// ── 결산 계산 ──────────────────────────────────────────
// PERF Round 4 (Expert 2+8): avgScore는 N×4 sort comparison에서 호출됨.
// item._avg에 캐시하면 재계산 회피. 순수 함수 보장: 캐시는 단일 빌드 cycle 내.
function avgScore(item) {
  if (!item || !item.scores) return 0;
  if (item._avg != null) return item._avg;
  const s = item.scores;
  return item._avg = (Number(s.impact || 0) + Number(s.freshness || 0) + Number(s.depth || 0) + Number(s.buzz || 0)) / 4;
}

function buildConclusion(news) {
  if (!news.length) return { headline: "오늘은 새 발행이 없습니다.", scoreAvg: 0, vs7d: 0 };
  const explicit = news.find((n) => n.headline);
  const itOnly = news.filter((n) => n.itRelevance == null || n.itRelevance >= 0.5);
  const sortedByScore = (itOnly.length ? itOnly : news).sort((a, b) => avgScore(b) - avgScore(a));
  const top = explicit || sortedByScore[0];
  const topScore = avgScore(top);
  const scoreAvg = round2(topScore);
  // 🌏 Round 5: 한글 번역 우선 (translate.js가 채워둔 title_ko 사용)
  const topTitle = (top.title_ko && top.title_ko.trim()) || top.title;
  const headline = explicit || topScore >= 3.5
    ? topTitle
    : `오늘 IT 주요 이슈가 약합니다 — 최고 점수 ${topScore.toFixed(1)}/5.0 (${topTitle.slice(0, 60)}…)`;
  return { headline, scoreAvg, vs7d: 0 };
}

function buildFiveLines(news) {
  const sorted = [...news].sort((a, b) => avgScore(b) - avgScore(a));
  // 🌏 Round 5: 한글 번역 우선
  return sorted.slice(0, 5).map((n) => ({
    text: (n.title_ko && n.title_ko.trim()) || n.title,
    anchorId: n.id,
  }));
}

function buildStats(news, insightsCount) {
  const hi = news.filter((n) => avgScore(n) >= 4.5);
  const cats = new Set(news.map((n) => n.category).filter(Boolean));
  return {
    newsTotal: news.length,
    score45plus: hi.length,
    categoriesActive: cats.size,
    insights: insightsCount,
    todayVs7d: 0,
    todayVs7dPercent: 0,
  };
}

function buildBuckets(items, kstNowIso) {
  // KST 기준 어제(D-1) / 오늘(D-day) / 기록용(>D-1) / 전체.
  // KST = UTC+9. KST midnight in UTC ms = Date.UTC(yyyy,mm,dd) - 9h.
  const now = new Date(kstNowIso);
  const kstShift = 9 * 3600 * 1000;
  const kstNow = new Date(now.getTime() + kstShift);
  const todayKstMidnightUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstShift;
  const yesterdayKstMidnightUtc = todayKstMidnightUtc - 24 * 3600 * 1000;
  let yesterday = 0, today = 0, archival = 0;
  items.forEach((it) => {
    const ms = Date.parse(it.publishedAt);
    if (isNaN(ms)) return;
    if (ms >= todayKstMidnightUtc) today++;
    else if (ms >= yesterdayKstMidnightUtc) yesterday++;
    else archival++;
  });
  return {
    yesterday: { label: "어제", count: yesterday, active: true },
    today:     { label: "오늘", count: today,     active: false },
    archival:  { label: "기록용", count: archival, active: false },
    all:       { label: "전체", count: items.length, active: false },
  };
}

const DIVERSITY_COLORS = {
  US: "#3b82f6", KR: "#ef4444", Global: "#10b981",
  CN: "#f59e0b", EU: "#a855f7", JP: "#ec4899", IN: "#0ea5e9",
};

function buildSourceDiversity(news) {
  const counts = {};
  news.forEach((n) => {
    const r = n.sourceCountry || "Global";
    counts[r] = (counts[r] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  // 5개 region로 압축, 100% 합 보장
  const regions = ["US", "KR", "Global", "CN", "EU"];
  const segs = regions.map((r) => ({
    region: r,
    percent: Math.round((counts[r] || 0) / total * 100),
    color: DIVERSITY_COLORS[r] || "#94a3b8",
  })).filter((s) => s.percent > 0);
  // rounding 보정 — 합 100 유지
  const sum = segs.reduce((a, b) => a + b.percent, 0);
  if (sum !== 100 && segs.length) segs[0].percent += (100 - sum);
  return segs;
}

// 🧠 Round 5: 인사이트 본문 재설계 (사용자 피드백 반영).
//
// 이전 동작: 각 페르소나에 대해 1개 topNews를 매칭하고, 분석 본문이 페르소나
//   설명(background)을 그대로 출력. 사용자 피드백:
//   "인사이트는 각 페르소나 설명이 아니라 페르소나 별로 뉴스, 커뮤니티 글,
//    오픈소스 등을 분석해서 인사이트를 도출해줘"
//
// 새 동작:
//   1) 각 페르소나에 관심 키워드 (PERSONA_INTERESTS) 매핑
//   2) 키워드 매칭으로 페르소나 별 관련 뉴스 N개 + 커뮤니티 M개 + OSS K개 추출
//   3) 추출된 항목을 종합해 페르소나 시각의 분석 본문 자동 생성
//      (제목 패턴, 키 시그널, 데이터 포인트, 액션 권고 4단 구성)
//   4) 페르소나 background는 모달 별도 섹션에 표시 (분석 본문과 분리)

// 페르소나 ID → 관심 키워드 (제목/요약/태그 매칭). 소문자 비교.
const PERSONA_INTERESTS = {
  "lee-jae-yong":     ["acquisition", "merger", "ipo", "투자", "전략", "ceo", "chairman", "antitrust", "regulation", "supply chain", "공급망"],
  "han-jong-hee":     ["galaxy", "tv", "smart home", "iot", "smartthings", "consumer", "냉장고", "에어컨", "tv", "가전", "bespoke", "tizen"],
  "jeon-young-hyun":  ["semiconductor", "memory", "hbm", "dram", "nand", "foundry", "tsmc", "반도체", "메모리", "ai chip", "wafer", "fab"],
  "noh-tae-moon":     ["smartphone", "iphone", "galaxy", "android", "foldable", "폴더블", "z fold", "z flip", "mobile", "갤럭시", "exynos", "snapdragon"],
  "lee-young-hee":    ["marketing", "brand", "campaign", "launch", "unpacked", "advertising", "글로벌", "메시지", "consumer", "global"],
  "park-hak-gyu":     ["appliance", "refrigerator", "washer", "dryer", "vacuum", "robot", "lg", "haier", "midea", "smart home", "iot", "samsung dishwasher"],
  "han-jin-man":      ["tsmc", "foundry", "wafer", "yield", "2nm", "3nm", "5nm", "process node", "intel foundry", "nvidia chip", "qualcomm", "tesla chip"],
  "park-yong-in":     ["exynos", "snapdragon", "ap", "soc", "image sensor", "isocell", "sensor", "ddi", "mediatek", "system lsi"],
  "yong-suk-woo":     ["tv", "qled", "oled", "micro-led", "neo qled", "display", "tizen", "디스플레이", "monitor", "lg display", "sony tv"],
  "lee-jung-bae":     ["dram", "ddr5", "lpddr", "hbm", "hbm3", "hbm4", "cxl", "memory bandwidth", "sk hynix", "micron", "storage", "ssd", "nand"],
  "kim-woo-jun":      ["5g", "6g", "open ran", "vran", "telecom", "통신", "wireless", "verizon", "at&t", "ntt", "ericsson", "nokia"],
  "song-jae-hyuk":    ["semiconductor", "euv", "gaa", "transistor", "patterning", "lithography", "research", "process technology", "intel", "tsmc node"],
  "dx-cto":           ["on-device", "ai", "llm", "bixby", "smartthings", "edge ai", "fitness", "health", "wearable", "watch", "ring", "buds", "ar glass", "iot"],
  "jung-hyeon-ho":    ["organization", "synergy", "restructure", "leadership", "talent", "executive", "strategy", "portfolio", "capital allocation"],
  "park-soon-cheol":  ["earnings", "revenue", "capex", "operating profit", "investment", "ir", "buyback", "dividend", "수익", "재무", "투자"],
  "kim-won-kyong":    ["chips act", "regulation", "antitrust", "eu", "tariff", "sanction", "policy", "export control", "ai act", "정책", "규제", "trade"],
  "ahn-joong-hyun":   ["acquisition", "merger", "m&a", "buyout", "investment", "harman", "automotive", "audi", "automotive supplier", "cariad"],
  "march-hahn":       ["us market", "verizon", "at&t", "best buy", "costco", "fcc", "texas", "taylor", "north america", "carrier", "us government"],
  "samsung-next":     ["startup", "vc", "venture", "seed", "series a", "series b", "yc", "y combinator", "founder", "saas", "developer tool"],
  "samsung-strategy": ["competitor", "apple", "google", "meta", "amazon", "microsoft", "nvidia", "tsmc", "sk hynix", "lg", "market share", "trend"],
};

function scoreItemForPersona(item, interestKeywords) {
  const text = `${item.title || ""} ${item.summary || item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  let score = 0;
  for (const kw of interestKeywords) {
    if (text.includes(kw)) score += 1;
  }
  // 본인 점수 + 매칭 카운트 — 페르소나 관심도가 높은 항목 우선.
  return score;
}

function pickRelatedItems(items, interestKeywords, limit) {
  if (!items || !items.length) return [];
  const kws = interestKeywords || [];
  // 매칭 점수 + 항목 자체 점수(avgScore) 가중 합.
  const scored = items.map((it) => {
    const personaMatch = kws.length ? scoreItemForPersona(it, kws) : 0;
    const itemAvg = it.scores ? avgScore(it) : (it.points ? Math.min(5, Math.log10((it.points || 1) + 1) + 2) : 2);
    return {
      item: it,
      score: personaMatch * 2 + itemAvg,
      hasMatch: personaMatch > 0,
    };
  });
  // 키워드 매칭이 있는 항목 우선; 매칭 부족 또는 keywords가 비어 있으면 점수 높은 일반 항목 fallback.
  const matched = scored.filter((s) => s.hasMatch).sort((a, b) => b.score - a.score);
  if (matched.length >= limit) return matched.slice(0, limit).map((s) => s.item);
  const others = scored.filter((s) => !s.hasMatch).sort((a, b) => b.score - a.score);
  return [...matched, ...others].slice(0, limit).map((s) => s.item);
}

function buildInsights(news, oss, community, experts, templates, research) {
  if (!experts || !templates) return [];
  const allResearch = research || [];
  // research도 인사이트 분석 대상에 포함 (논문·특허는 페르소나 의사결정의 근거)
  const newsAndResearch = [...news, ...allResearch];

  return experts.map((expert, idx) => {
    const tpl = templates[expert.id];
    if (!tpl) return null;
    const interests = PERSONA_INTERESTS[expert.id] || [];
    // 페르소나별 관련 항목 추출
    const relNews = pickRelatedItems(newsAndResearch, interests, 5);
    const relOss = pickRelatedItems(oss, interests, 3);
    const relCom = pickRelatedItems(community, interests, 3);

    // top news/oss/community 1개씩 → 분석 본문의 핵심 시그널
    const topNews = relNews[0];
    if (!topNews) return null;
    const secondNews = relNews[1];
    const topOss = relOss[0];
    const topCom = relCom[0];

    // 분석 본문 — 페르소나 시각의 종합 분석 (자동 생성)
    const analysis = buildPersonaAnalysis(expert, {
      topNews, secondNews, topOss, topCom, relNews, relOss, relCom,
    });
    // excerpt — 카드 미리보기. 페르소나 설명이 아닌 분석 핵심 한 줄.
    const excerpt = buildInsightExcerpt(expert, { topNews, topOss, topCom });

    return {
      id: `i${String(idx + 1).padStart(2, "0")}`,
      expertId: expert.id,
      tag: tpl.tag,
      title: tpl.titleTemplate.replace("{topNewsTitle}", truncate(topNews.title, 60)),
      excerpt,
      keyQuestion: tpl.keyQuestion,
      analysis,
      // 관련 항목 ID — 모달 하단 "관련 ___" 섹션에 노출
      relatedNewsIds: relNews.slice(0, 3).map((n) => n.id).filter(Boolean),
      relatedOssIds: relOss.slice(0, 3).map((o) => o.id).filter(Boolean),
      relatedCommunityIds: relCom.slice(0, 3).map((c) => c.id).filter(Boolean),
    };
  }).filter(Boolean);
}

// 페르소나 분석 본문 — 4단 구조:
//   1) 핵심 시그널 (topNews 1-2개 인용)
//   2) 데이터 포인트 (점수, 출처, 커뮤니티 반응)
//   3) 페르소나 시각의 의미 (역할 기반 해석)
//   4) 권고 액션 (의사결정 시간선)
function buildPersonaAnalysis(expert, ctx) {
  const { topNews, secondNews, topOss, topCom, relNews, relOss, relCom } = ctx;
  const out = [];
  const role = expert.role || "";

  // 1) 핵심 시그널
  out.push("## 📡 오늘의 핵심 시그널");
  out.push("");
  out.push(`**${topNews.title}** (${topNews.source || "—"})`);
  if (topNews.summary) out.push(`> ${topNews.summary.slice(0, 200)}${topNews.summary.length > 200 ? "…" : ""}`);
  if (secondNews) {
    out.push("");
    out.push(`보조 시그널: **${secondNews.title}** (${secondNews.source || "—"})`);
  }
  out.push("");

  // 2) 데이터 포인트 — 정량 시그널
  out.push("## 📊 데이터 포인트");
  out.push("");
  if (topNews.scores) {
    const s = topNews.scores;
    out.push(`- 핵심 뉴스 점수: 파급력 ${fmt1(s.impact)} · 시의성 ${fmt1(s.freshness)} · 기술도 ${fmt1(s.depth)} · 반응도 ${fmt1(s.buzz)}`);
  }
  if (topCom) {
    out.push(`- 커뮤니티 신호: **${truncate(topCom.title, 70)}** (${topCom.sourceLabel || topCom.source || "—"}, ${fmt1(topCom.points || 0)}pts)`);
  }
  if (topOss) {
    out.push(`- 오픈소스 활동: **${topOss.name || topOss.title}** (${topOss.language || "—"}, +${(topOss.starsThisWeek || 0)} stars/주)`);
  }
  out.push(`- 관련 항목 종합: 뉴스 ${relNews.length}건 · 커뮤니티 ${relCom.length}건 · OSS ${relOss.length}건`);
  out.push("");

  // 3) 페르소나 시각 — 역할 기반 해석
  out.push(`## 🎯 ${role}의 시각`);
  out.push("");
  out.push(personaInterpret(expert, ctx));
  out.push("");

  // 4) 권고 액션
  out.push("## ✅ 권고 액션");
  out.push("");
  out.push(personaRecommend(expert, ctx));
  return out.join("\n");
}

// 페르소나 시각 — 역할별 해석 패턴.
// 모든 페르소나가 자신의 직책 관점에서 시그널을 어떻게 받아들이는지 1-2문단.
function personaInterpret(expert, { topNews, secondNews, topOss, topCom }) {
  const role = expert.role || "";
  const newsTitle = truncate(topNews.title, 60);
  const intro = `**${expert.name}** (${role})의 관점에서 이 신호는`;

  // 페르소나별 패턴 (id 매칭)
  const interpretations = {
    "lee-jae-yong":     `${intro} 5-10년 시간선의 사업 포트폴리오 시그널이다. "${newsTitle}"가 단순 트렌드가 아닌 산업 구조 변화의 초기 신호인지를 판별해야 한다. 경쟁사가 같은 방향으로 움직이고 있는지, 우리가 선도/추격/회피 중 어느 입장이어야 하는지를 결정해야 할 시점.`,
    "han-jong-hee":     `${intro} DX 부문의 1억+ 고객 단말 경험에 직접 영향을 줄 수 있는 시그널이다. "${newsTitle}"가 갤럭시·TV·가전 통합 사용자 경험의 다음 차별화 포인트가 될 수 있는지, 통합 시점은 언제인지를 판단해야 한다.`,
    "jeon-young-hyun":  `${intro} HBM·파운드리·시스템 LSI 의 R&D 우선순위에 영향을 주는 시그널이다. "${newsTitle}"가 SK하이닉스·TSMC·인텔과의 격차 구도를 어떻게 바꾸는지, 우리 capa·wafer 할당을 재조정해야 하는지를 판단해야 한다.`,
    "noh-tae-moon":     `${intro} 갤럭시 다음 세대 단말의 차별화 자산이 될 수 있는 시그널이다. "${newsTitle}"가 iPhone과의 격차를 좁히거나 폴더블 우위를 확장할 수 있는 카드인지, 온디바이스 vs 클라우드 분배는 어떻게 해야 하는지를 결정해야 한다.`,
    "lee-young-hee":    `${intro} 200개국 글로벌 마케팅 메시지의 새 축이 될 수 있는 시그널이다. "${newsTitle}"를 어떤 스토리로 풀어 Apple/Google과 차별화할지, Galaxy Unpacked 메시지 전략에 어떻게 통합할지를 판단해야 한다.`,
    "park-hak-gyu":     `${intro} DA(생활가전) marginal cost와 SmartThings 생태계에 영향을 주는 시그널이다. "${newsTitle}"가 LG·Haier·Midea와의 가전 경쟁에서 우리의 IoT/AI 우위를 강화할지, 회수 시간선은 얼마인지를 판단해야 한다.`,
    "han-jin-man":      `${intro} 파운드리 고객 확보 경쟁에서의 시그널이다. "${newsTitle}"가 NVIDIA/Qualcomm/Tesla 같은 핵심 고객의 의사결정에 영향을 주는지, TSMC와의 yield·node 격차를 좁힐 기회를 만드는지를 판단해야 한다.`,
    "park-yong-in":     `${intro} Exynos·ISOCELL 로드맵에 직접 영향을 주는 시그널이다. "${newsTitle}"가 Snapdragon과의 SoC 경쟁에서 차세대 우위를 만들 수 있는지, 이미지 센서 시장 점유율 확대에 활용할 수 있는지를 판단해야 한다.`,
    "yong-suk-woo":     `${intro} TV/모니터 ASP와 콘텐츠 생태계에 영향을 주는 시그널이다. "${newsTitle}"가 Sony·LG의 OLED 공세를 방어할 카드인지, TCL·Hisense의 가성비 공세에 대응할 무기가 될 수 있는지를 판단해야 한다.`,
    "lee-jung-bae":     `${intro} HBM·DDR·LPDDR 수요 곡선의 변곡점 시그널이다. "${newsTitle}"가 NVIDIA H200/B100 인증 또는 차세대 AI 서버 메모리 표준에 어떤 영향을 주는지, HBM4·CXL 양산 시점에 시사하는 것이 무엇인지를 판단해야 한다.`,
    "kim-woo-jun":      `${intro} 5G/6G 장비 수주 환경에 영향을 주는 시그널이다. "${newsTitle}"가 Verizon·AT&T·NTT 고객 결정에 어떤 영향을 주는지, Open RAN/vRAN 채택 추세에 우리가 어떻게 대응해야 하는지를 판단해야 한다.`,
    "song-jae-hyuk":    `${intro} 10년 시간선 R&D 로드맵에 직접 영향을 주는 시그널이다. "${newsTitle}"가 EUV·GAA·차세대 패키징 기술의 발전 속도를 어떻게 바꾸는지, 우리 차세대 노드 결정에 어떤 시사점이 있는지를 판단해야 한다.`,
    "dx-cto":           `${intro} DX 부문 단말 통합 우선순위에 영향을 주는 시그널이다. "${newsTitle}"가 갤럭시·TV·가전 중 어느 단말에 먼저 통합되어야 하는지, 다른 사업부와의 시너지를 어떻게 만들지, 외부 파트너십·인수 옵션은 무엇인지를 판단해야 한다.`,
    "jung-hyeon-ho":    `${intro} 사업부 간 자원 재분배·M&A·인사 정책에 영향을 주는 시그널이다. "${newsTitle}"가 우리 조직 구조나 우선순위를 어떻게 재조정하게 만드는지, 다른 사업부에 미치는 파급은 어떤지를 판단해야 한다.`,
    "park-soon-cheol":  `${intro} CapEx 결정과 IRR/NPV 시간선에 영향을 주는 시그널이다. "${newsTitle}"가 우리 향후 3년 투자 우선순위를 어떻게 바꾸는지, ROI 회수 시점이 어떻게 변동하는지를 정량적으로 판단해야 한다.`,
    "kim-won-kyong":    `${intro} 미국 CHIPS Act, EU AI Act, 한국 K-반도체 정책 등 글로벌 규제 환경의 시그널이다. "${newsTitle}"가 우리 미국·EU·중국 사업의 제약·기회를 어떻게 바꾸는지, 정부 인센티브 협상에서 어떻게 활용할 수 있는지를 판단해야 한다.`,
    "ahn-joong-hyun":   `${intro} 검토 중인 M&A pipeline의 가치·우선순위에 영향을 주는 시그널이다. "${newsTitle}"가 인수 후보의 valuation을 어떻게 바꾸는지, antitrust 심사 환경은 어떤지, 대안 후보가 등장했는지를 판단해야 한다.`,
    "march-hahn":       `${intro} 미국 시장 channel·통신사 협력·정부 입찰에 영향을 주는 시그널이다. "${newsTitle}"가 Verizon·AT&T·Best Buy와의 관계, FCC 규제, Texas Fab 운영에 어떤 영향을 주는지를 판단해야 한다.`,
    "samsung-next":     `${intro} 사내 VC 투자 pipeline에 영향을 주는 시그널이다. "${newsTitle}"와 관련된 스타트업이 우리 사업부와 PoC 가능한지, 인수 가치가 있는지, 경쟁사가 먼저 인수할 위험이 있는지를 판단해야 한다.`,
    "samsung-strategy": `${intro} 2-3년 후 시장 구조에 대한 시그널이다. "${newsTitle}"가 Apple/Google/Meta/TSMC/SK하이닉스/LG의 경쟁 구도를 어떻게 재편하는지, 우리가 지금 준비해야 할 카드는 무엇인지를 판단해야 한다.`,
  };

  return interpretations[expert.id] || `${intro} 우리 사업 결정에 영향을 줄 수 있는 시그널이다. "${newsTitle}"의 의미를 우리 역할 관점에서 검토해야 한다.`;
}

// 권고 액션 — 페르소나 직책 시간선에 맞춘 1-2개 actionable 항목
function personaRecommend(expert, { topNews, topOss, topCom }) {
  const recommendations = {
    "lee-jae-yong":     `1. 이 트렌드와 관련된 글로벌 경쟁사(Apple/TSMC/NVIDIA/SK하이닉스)의 동향을 향후 4주간 모니터.\n2. 우리 사업 포트폴리오 중 ${topNews.category || "관련"} 카테고리에 추가 투자할지를 다음 분기 회의에서 결정.`,
    "han-jong-hee":     `1. DX 사업부장 회의에서 이 기술의 갤럭시·TV·가전 통합 우선순위를 정렬.\n2. 6개월 내 PoC 가능 여부를 R&D 팀에 요청하고, Galaxy Unpacked 일정과 동기화.`,
    "jeon-young-hyun":  `1. 이 시그널이 HBM·DDR·파운드리 capa 수요 예측에 미치는 영향을 12주 내 정량화.\n2. SK하이닉스·TSMC·인텔의 동일 트렌드 대응 모니터링 강화.`,
    "noh-tae-moon":     `1. 다음 갤럭시 라인업의 차별화 핵심으로 통합 가능한지 MX UX 팀과 검토.\n2. 온디바이스 vs 클라우드 비중 결정을 위한 latency/cost 벤치마크 의뢰.`,
    "lee-young-hee":    `1. 200개국 마케팅 메시지에 이 트렌드를 어떻게 통합할지 글로벌 캠페인 팀과 5주 내 결정.\n2. Apple 마케팅 동향과 비교한 차별화 포인트 도출.`,
    "park-hak-gyu":     `1. SmartThings 생태계 통합 우선순위를 6주 내 재검토.\n2. LG·Haier·Midea의 동일 트렌드 대응 동향 추적.`,
    "han-jin-man":      `1. NVIDIA·Qualcomm·Tesla 등 핵심 파운드리 고객의 결정 동향을 4주 내 점검.\n2. 2nm/3nm 양산 일정에 영향이 있다면 우선순위 재조정.`,
    "park-yong-in":     `1. Exynos 차세대 로드맵에 통합 가능 여부를 SoC 팀과 8주 내 검토.\n2. ISOCELL 이미지 센서 차세대 모델 개발에 시사점이 있는지 확인.`,
    "yong-suk-woo":     `1. Neo QLED·OLED·micro-LED 라인업 가격 정책에 영향이 있는지 검토.\n2. Tizen OS 광고 플랫폼에 통합 가능 여부를 4주 내 결정.`,
    "lee-jung-bae":     `1. HBM4·CXL·LPDDR6 양산 일정 검토 — 이 시그널이 NVIDIA 인증 일정에 영향이 있는지.\n2. 메모리 마진 회복 시점 예측 업데이트.`,
    "kim-woo-jun":      `1. Verizon·AT&T·NTT 고객 미팅에서 이 시그널이 5G/6G 의사결정에 영향이 있는지 청취.\n2. Open RAN 표준화 동향 모니터링 강화.`,
    "song-jae-hyuk":    `1. 차세대 R&D 로드맵에 이 기술 변화를 반영할 시점을 8주 내 결정.\n2. 학계·오픈소스 동향에서 추가 신호가 있는지 분기 별 점검.`,
    "dx-cto":           `1. 갤럭시·TV·가전 중 우선 통합 단말을 4주 내 결정.\n2. 외부 파트너십·인수 옵션이 있는지 Samsung NEXT와 검토.`,
    "jung-hyeon-ho":    `1. 이 시그널이 사업부 간 자원 재분배에 영향이 있는지 부회장단 회의에서 검토.\n2. 인사 정책 또는 조직 구조 변경이 필요한지 8주 내 판단.`,
    "park-soon-cheol":  `1. 향후 3년 CapEx 우선순위에 미치는 영향을 IR 팀과 정량화.\n2. 환율·금리 시나리오에 따른 ROI 회수 시점 재계산.`,
    "kim-won-kyong":    `1. 미국·EU·중국 정부 관계자 미팅에서 이 정책 변화의 의미를 4주 내 청취.\n2. CHIPS Act/AI Act 인센티브 협상에 활용 가능한지 검토.`,
    "ahn-joong-hyun":   `1. M&A pipeline 후보의 valuation 재산정.\n2. 경쟁 인수자의 동향 모니터링 강화.`,
    "march-hahn":       `1. 미국 통신사·유통 채널 미팅에서 이 시그널이 결정에 영향이 있는지 청취.\n2. FCC·Texas 정부 관계자와의 업데이트 주기 강화.`,
    "samsung-next":     `1. 이 트렌드와 관련된 스타트업 후보를 4주 내 발굴 — 우리 사업부와 PoC 가능 여부 검토.\n2. 경쟁 VC의 투자 동향 모니터링.`,
    "samsung-strategy": `1. 2-3년 후 시장 구조 시나리오에 이 트렌드 반영 — 회장 보고용 브리핑에 추가.\n2. 경쟁사(Apple/Google/TSMC) 대응 동향을 매주 점검.`,
  };

  const rec = recommendations[expert.id] || `1. 이 트렌드의 우리 사업 영향을 6주 내 평가.\n2. 관련 외부 동향을 분기 별로 점검.`;

  // 출처 인용 (관련 항목 1-2개를 액션과 연결)
  const citations = [];
  if (topOss) citations.push(`참고 OSS: **${topOss.name || topOss.title}**`);
  if (topCom) citations.push(`참고 커뮤니티: **${truncate(topCom.title, 50)}** (${topCom.sourceLabel || ""})`);
  return rec + (citations.length ? "\n\n" + citations.join(" · ") : "");
}

// 카드 미리보기 — 1-2 문장. 페르소나 설명이 아닌 분석 핵심.
function buildInsightExcerpt(expert, { topNews, topOss, topCom }) {
  const sources = [];
  if (topNews) sources.push("뉴스");
  if (topCom) sources.push("커뮤니티");
  if (topOss) sources.push("OSS");
  const sourceStr = sources.join("·");
  return `${expert.name}(${expert.role})이 ${sourceStr}를 종합 분석. "${truncate(topNews.title, 50)}"의 시사점을 ${expert.role.split(" ")[0]} 시각으로 해석.`;
}

function fmt1(n) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toFixed(1);
}

function pickIds(arr, n) {
  return (arr || []).slice(0, n).map((x) => x.id).filter(Boolean);
}

function truncate(s, n) {
  s = String(s || "");
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function round2(n) { return Math.round(n * 100) / 100; }

function buildLead(news, scoreAvg) {
  const top = [...news].sort((a, b) => avgScore(b) - avgScore(a))[0];
  if (!top) return "오늘은 새 발행이 없습니다. 데이터 수집 파이프라인 점검이 필요합니다.";
  return `오늘 ${news.length}건의 뉴스 중 종합 평균 ${scoreAvg.toFixed(2)}점. 최고 점수 항목은 "${truncate(top.title, 80)}"이며, ${top.source || "외부"} 출처. 의사결정자는 이 항목의 영향 시간선을 다음 1~2주 내에 평가해야 한다. (LLM 통합 후 분석이 자동 생성됩니다.)`;
}

// ── Serializer (window.__DAILY__ = {...}) ───────────────
// PERF Round 4 (Expert 6 Joyee + Expert 9 Bert): drop pretty-print on auto-generated file.
// 35-40% 사이즈 + 1.7-2.0× stringify 속도 + 브라우저 parse 속도 모두 절감.
// DEBUG=1일 때만 indent.
function serialize(daily) {
  const indent = process.env.DEBUG ? 2 : 0;
  const json = indent ? JSON.stringify(daily, null, indent) : JSON.stringify(daily);
  // _avg 캐시 필드 제거 (browser에 노출 X) — JSON.stringify 직전 cleanup이 깔끔하나
  // 여기선 stringify 후 정규식으로 빠르게 제거.
  const cleaned = json.replace(/,"_avg":[0-9.]+/g, "");
  return `// AUTO-GENERATED by scripts/build-today.js — do not edit.
// To rebuild: node scripts/collect.js && node scripts/score.js && node scripts/build-today.js
window.__DAILY__ = ${cleaned};
`;
}

// ── 메인 ──────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.in)) {
    console.error(`✖ scored input not found: ${args.in} — run 'node scripts/score.js' first`);
    process.exit(1);
  }
  const t0 = Date.now();
  const scored = JSON.parse(fs.readFileSync(args.in, "utf8"));
  const allNews = scored.news || [];
  const community = scored.community || [];
  const oss = scored.oss || [];

  // 🆕 Round 5: 논문·특허·표준 분리
  // 사용자 피드백 ("논문, 특허/표준은 뉴스, 커뮤니티, 오픈소스, '논문/특허/표준'
  // 레벨의 탭으로 옮기고 관련된 내용들의 레벨을 모두 옮겨서 필터나 검색이 정상").
  // 기존: news[] 내부에 papers/standards 카테고리 항목 혼재 → 필터·헤드라인 후보에 포함.
  // 개선: papers/standards 항목은 별도 research[] 도메인으로 분리. 헤드라인은
  //       news[]에서만 (사용자 요청 "헤드라인은 뉴스에서만 뽑아주고") 추출.
  const RESEARCH_CATEGORIES = new Set(["papers", "standards"]);
  const news = allNews.filter((n) => !RESEARCH_CATEGORIES.has(n.category));
  const research = allNews.filter((n) => RESEARCH_CATEGORIES.has(n.category));

  // PERF Round 4 (Expert 2 Egorov + Expert 8 Caswell):
  // avgScore() pre-compute 1회로 buildConclusion/buildFiveLines/buildInsights/buildLead의
  // 4번 sort comparator 호출에서 N×4 = 4N의 score 재계산 제거.
  for (const n of news) avgScore(n);
  for (const r of research) avgScore(r);

  // 시드 로드
  const tpl = loadGlobal(TEMPLATE, "__TODAY_TEMPLATE__") || {};
  const experts = loadGlobal(EXPERTS, "__EXPERTS__") || [];

  // 자동 영역 — buildInsights를 먼저 호출해 그 length가 counts/stats의 source of truth.
  // 🧠 Round 5: 인사이트는 news + community + oss + research 모두를 분석 대상으로.
  const insights   = buildInsights(news, oss, community, experts, tpl.insightTemplates, research);
  const conclusion = buildConclusion(news); // 헤드라인은 news[]에서만 (사용자 요청)
  const fiveLines  = buildFiveLines(news);
  const counts     = {
    news: news.length,
    community: community.length,
    oss: oss.length,
    research: research.length,
    insights: insights.length,
  };
  const stats      = buildStats(news, insights.length);
  const generatedAt = new Date().toISOString();
  const buckets    = buildBuckets(news, generatedAt);
  const sourceDiversity = buildSourceDiversity(news);

  // 시드 영역 (없으면 자동 생성으로 fallback)
  const quote = tpl.quote || { text: "—", author: "—", role: "—", url: "" };
  const lead  = tpl.lead || buildLead(news, conclusion.scoreAvg);
  const influencers = tpl.influencers || [];

  // KST 어제 날짜 — Intl.DateTimeFormat with timeZone를 사용해 cron 시각·UTC offset과 무관하게 정확
  const kstNowMs = Date.now();
  const kstYesterdayMs = kstNowMs - 24 * 3600 * 1000;
  const fmt = new Intl.DateTimeFormat("en-CA", { // en-CA는 YYYY-MM-DD 형식 출력
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const date = fmt.format(new Date(kstYesterdayMs)); // "2026-05-02"

  const daily = {
    date, generatedAt,
    window: { hours: scored.windowHours || 24 },
    conclusion, counts, fiveLines, quote, lead, stats,
    buckets, sourceDiversity, influencers,
    news, community, oss, research, insights,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, serialize(daily));
  const dt = Date.now() - t0;
  console.log(`[build-today] wrote ${path.relative(process.cwd(), args.out)} · news ${news.length} · community ${community.length} · oss ${oss.length} · insights ${insights.length} · ${dt}ms`);

  // 검증
  if (args.validate) {
    const r = spawnSync("node", [VALIDATOR, args.out], { encoding: "utf8" });
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    if (r.status !== 0) {
      console.error(`✖ validate-data.js exited ${r.status} — generated today.js failed validation`);
      process.exit(r.status);
    }
  }
}

if (require.main === module) main();

module.exports = {
  buildConclusion, buildFiveLines, buildBuckets, buildSourceDiversity,
  buildStats, buildInsights, serialize, avgScore, loadGlobal,
};
