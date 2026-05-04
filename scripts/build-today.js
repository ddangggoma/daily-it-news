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
function avgScore(item) {
  if (!item || !item.scores) return 0;
  const s = item.scores;
  return (Number(s.impact || 0) + Number(s.freshness || 0) + Number(s.depth || 0) + Number(s.buzz || 0)) / 4;
}

function buildConclusion(news) {
  if (!news.length) return { headline: "오늘은 새 발행이 없습니다.", scoreAvg: 0, vs7d: 0 };
  // headline=true 가 score.js에서 임계 통과 시에만 set 됨.
  // 우선순위: 명시적 headline → 점수 1위 → fallback 메시지.
  const explicit = news.find((n) => n.headline);
  const sortedByScore = [...news].sort((a, b) => avgScore(b) - avgScore(a));
  const top = explicit || sortedByScore[0];
  const topScore = avgScore(top);
  // 5초 결론의 종합 점수는 "헤드라인 점수" — 사용자 기대와 일치.
  // (전체 news 평균이 아니라 가장 중요한 이슈 1건의 점수.)
  const scoreAvg = round2(topScore);
  // 임계 미달 시 약한 시그널 표시 (3.5 미만)
  const headline = explicit || topScore >= 3.5
    ? top.title
    : `오늘 주요 이슈가 약합니다 — 최고 점수 ${topScore.toFixed(1)}/5.0 (${top.title.slice(0, 60)}…)`;
  return { headline, scoreAvg, vs7d: 0 };
}

function buildFiveLines(news) {
  const sorted = [...news].sort((a, b) => avgScore(b) - avgScore(a));
  return sorted.slice(0, 5).map((n) => ({
    text: n.title,
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

function buildInsights(news, oss, community, experts, templates) {
  if (!experts || !templates) return [];
  const sorted = [...news].sort((a, b) => avgScore(b) - avgScore(a));
  return experts.map((expert, idx) => {
    const tpl = templates[expert.id];
    if (!tpl) return null;
    const topNews = sorted[idx % Math.max(1, sorted.length)] || sorted[0];
    if (!topNews) return null;
    return {
      id: `i${String(idx + 1).padStart(2, "0")}`,
      expertId: expert.id,
      tag: tpl.tag,
      title: tpl.titleTemplate.replace("{topNewsTitle}", truncate(topNews.title, 60)),
      excerpt: `${expert.role} ${expert.name}의 시각: ${topNews.title.slice(0, 80)} 외 관련 기사를 종합한 분석.`,
      keyQuestion: tpl.keyQuestion,
      analysis: buildPlaceholderAnalysis(expert, topNews),
      relatedNewsIds: pickIds(sorted.slice(0, 5), 3),
      relatedOssIds: pickIds(oss.slice(0, 5), 2),
      relatedCommunityIds: pickIds(community.slice(0, 5), 2),
    };
  }).filter(Boolean);
}

function buildPlaceholderAnalysis(expert, topNews) {
  return [
    `## ${expert.role}의 관점`,
    "",
    expert.background || "",
    "",
    `## 오늘의 핵심`,
    "",
    `- 헤드라인: ${topNews.title}`,
    `- 영향 점수: ${topNews.scores ? topNews.scores.impact : "—"}`,
    `- 출처: ${topNews.source || "—"}`,
    "",
    `## 권고`,
    "",
    `이 발표가 향후 6개월 결정에 미치는 영향을 검토하세요. (LLM 통합 후 분석이 자동 생성됩니다.)`,
  ].join("\n");
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
function serialize(daily) {
  // JSON.stringify로 충분 — top-level은 window 할당, 내부는 표준 JSON.
  // 가독성 위해 2-space indent.
  const json = JSON.stringify(daily, null, 2);
  return `// AUTO-GENERATED by scripts/build-today.js — do not edit.
// To rebuild: node scripts/collect.js && node scripts/score.js && node scripts/build-today.js
window.__DAILY__ = ${json};
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
  const news = scored.news || [];
  const community = scored.community || [];
  const oss = scored.oss || [];

  // 시드 로드
  const tpl = loadGlobal(TEMPLATE, "__TODAY_TEMPLATE__") || {};
  const experts = loadGlobal(EXPERTS, "__EXPERTS__") || [];

  // 자동 영역 — buildInsights를 먼저 호출해 그 length가 counts/stats의 source of truth
  const insights   = buildInsights(news, oss, community, experts, tpl.insightTemplates);
  const conclusion = buildConclusion(news);
  const fiveLines  = buildFiveLines(news);
  const counts     = { news: news.length, community: community.length, oss: oss.length, insights: insights.length };
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
    news, community, oss, insights,
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
