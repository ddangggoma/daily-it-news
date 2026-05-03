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
  // Tier 1 — primary source / 1차 보도
  "openai":             5.0, "anthropic":   5.0, "google":      5.0,
  "techcrunch":         4.5, "theverge":    4.4, "arstechnica": 4.6,
  // Tier 2 — community
  "hackernews":         4.0, "github_trending": 4.2,
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

const DEPTH_KEYWORDS = [
  // 기술 깊이 신호
  /\bbenchmark\b/i, /\bpaper\b/i, /\barxiv\b/i, /\bopen[- ]?source\b/i,
  /\b(transformer|attention|LSTM|RNN|CNN|GAN|VAE|RAG|reasoning)\b/i,
  /\b(latency|throughput|p99|p95|TFLOPS|TPS|QPS|memory|bandwidth)\b/i,
  /\b(SDK|API|protocol|implementation|architecture|infrastructure)\b/i,
  /\b(code|repo|commit|PR|merge|review)\b/i,
];

// ── 4기준 채점 ─────────────────────────────────────────
function scoreImpact(item) {
  // 1) 소스 권위
  const auth = SOURCE_AUTHORITY[item.source] || SOURCE_AUTHORITY._default;
  // 2) 키워드 가중치
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  let kw = 0;
  for (const [k, w] of Object.entries(IMPACT_KEYWORDS)) {
    if (text.includes(k.toLowerCase())) kw += w;
  }
  kw = Math.min(2.0, kw); // cap
  // 3) 결합 (가중 평균)
  const raw = auth * 0.7 + Math.min(5, auth + kw) * 0.3;
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
  // 키워드 매칭
  let matches = 0;
  for (const re of DEPTH_KEYWORDS) if (re.test(text)) matches++;
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
function shapeForDashboard(item, scores) {
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

function detectOssType(item) {
  const t = `${item.title} ${item.summary}`.toLowerCase();
  if (/\bagent\b/.test(t))      return "agent";
  if (/\bframework\b/.test(t))  return "framework";
  if (/\blibrary\b/.test(t))    return "library";
  if (/\b(model|llm|gpt)\b/.test(t)) return "model";
  if (/\bdataset\b/.test(t))    return "dataset";
  if (/\bruntime\b/.test(t))    return "runtime";
  return "tool";
}

function ossTypeIcon(type) {
  return {
    agent: "🤖", framework: "🏗", library: "📚", tool: "🔧",
    runtime: "⚡", model: "🧠", dataset: "📊",
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

  const news = [], community = [], oss = [];
  for (const item of items) {
    const baseScores = {
      impact:    scoreImpact(item),
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
    const shaped = shapeForDashboard(item, scores, args);
    if (item.domain === "news")      news.push(shaped);
    else if (item.domain === "community") community.push(shaped);
    else if (item.domain === "oss")  oss.push(shaped);
  }

  // featured 1개를 headline으로 (impact + freshness 합 최고)
  if (news.length) {
    news.sort((a, b) => (b.scores.impact + b.scores.freshness) - (a.scores.impact + a.scores.freshness));
    news[0].headline = true;
  }

  const out = {
    scoredAt: new Date().toISOString(),
    windowHours: args.windowHours,
    llm: args.llm,
    counts: { news: news.length, community: community.length, oss: oss.length },
    news, community, oss,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  const dt = Date.now() - t0;
  console.log(`[score] wrote ${path.relative(process.cwd(), args.out)} · news ${news.length} / community ${community.length} / oss ${oss.length} · ${args.llm ? "llm" : "heuristic"} · ${dt}ms`);
}

if (require.main === module) main().catch((e) => { console.error(`[score] FAILED: ${e.message}`); process.exit(1); });

module.exports = {
  scoreImpact, scoreFreshness, scoreDepth, scoreBuzz,
  shapeForDashboard, detectOssType, SOURCE_AUTHORITY,
};
