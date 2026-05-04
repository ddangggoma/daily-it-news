/**
 * build-today.test.js — node:test for scripts/build-today.js
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const m = require(path.join(ROOT, "scripts", "build-today.js"));

const sampleNews = [
  { id: "n1", title: "Top news", category: "ai", url: "https://e.com",
    source: "openai", sourceCountry: "US", publishedAt: new Date().toISOString(),
    summary: "x", scores: { impact: 5, freshness: 5, depth: 5, buzz: 5 }, tags: [] },
  { id: "n2", title: "Mid news", category: "ai", url: "https://e.com",
    source: "techcrunch", sourceCountry: "KR", publishedAt: new Date().toISOString(),
    summary: "x", scores: { impact: 3, freshness: 3, depth: 3, buzz: 3 }, tags: [] },
];

test("buildConclusion: highest-avg becomes headline", () => {
  const c = m.buildConclusion(sampleNews);
  assert.equal(c.headline, "Top news");
  // 헤드라인의 자체 점수 (이전엔 전체 뉴스 평균이었음 — 사용자 피드백 반영)
  // top news 점수 5점이 그대로 5초 결론 점수가 된다.
  assert.equal(c.scoreAvg, 5);
});

test("buildConclusion: empty array → fallback", () => {
  const c = m.buildConclusion([]);
  assert.match(c.headline, /새 발행이 없습니다/);
  assert.equal(c.scoreAvg, 0);
});

test("buildFiveLines: top 5 by avg score", () => {
  const news = Array.from({ length: 8 }, (_, i) => ({
    id: `n${i}`, title: `Title ${i}`,
    scores: { impact: i, freshness: i, depth: i, buzz: i },
  }));
  const lines = m.buildFiveLines(news);
  assert.equal(lines.length, 5);
  // 가장 높은 점수 (i=7) 가 첫 항목
  assert.equal(lines[0].anchorId, "n7");
  // 모든 항목이 anchorId 보유
  lines.forEach((l) => assert.ok(l.anchorId && l.text));
});

test("buildStats: counts categories + 4.5+ items + insights count from caller", () => {
  const news = [
    { category: "ai",       scores: { impact: 5, freshness: 5, depth: 5, buzz: 5 } },
    { category: "robotics", scores: { impact: 3, freshness: 3, depth: 3, buzz: 3 } },
    { category: "ai",       scores: { impact: 4.6, freshness: 4.6, depth: 4.6, buzz: 4.6 } },
  ];
  // signature changed: buildStats(news, insightsCount) — insights is now the actual
  // length, not a hardcoded 10. Closes correctness P1 #2.
  const s = m.buildStats(news, 7);
  assert.equal(s.newsTotal, 3);
  assert.equal(s.score45plus, 2);
  assert.equal(s.categoriesActive, 2);
  assert.equal(s.insights, 7);
});

test("buildBuckets: KST 기준 어제/오늘/기록용 분류", () => {
  // KST 2026-05-02 12:00 (UTC 03:00) 기준으로 분류 검증
  const kstNow = "2026-05-02T03:00:00Z"; // UTC representation of KST 12:00
  const items = [
    { publishedAt: "2026-05-02T01:00:00Z" }, // KST 10:00 today → today
    { publishedAt: "2026-05-01T05:00:00Z" }, // KST 14:00 어제 → yesterday
    { publishedAt: "2026-05-01T16:00:00Z" }, // KST 5/2 01:00 — boundary check, today
    { publishedAt: "2026-04-25T00:00:00Z" }, // 7일 전 → archival
  ];
  const b = m.buildBuckets(items, kstNow);
  assert.equal(b.all.count, 4);
  assert.equal(b.today.count + b.yesterday.count + b.archival.count, 4);
  assert.equal(b.archival.count, 1);
  // 한 항목만 archival, 나머지는 today/yesterday로 분배
});

test("buildSourceDiversity: percent sums to 100", () => {
  const news = [
    { sourceCountry: "US" }, { sourceCountry: "US" }, { sourceCountry: "US" },
    { sourceCountry: "KR" },
  ];
  const segs = m.buildSourceDiversity(news);
  const total = segs.reduce((a, b) => a + b.percent, 0);
  assert.equal(total, 100);
  // US 75%, KR 25% (대략 — 정확한 백분율은 보정 후)
  const us = segs.find((s) => s.region === "US");
  assert.ok(us && us.percent >= 70);
});

test("buildInsights: 각 expert에 항목 1개씩", () => {
  const experts = [
    { id: "pari", role: "기회 탐지자", name: "파리" },
    { id: "mae",  role: "패턴 인식가", name: "메" },
  ];
  const templates = {
    pari: { tag: "opportunity", titleTemplate: "Test {topNewsTitle}", keyQuestion: "?" },
    mae:  { tag: "pattern",     titleTemplate: "Test {topNewsTitle}", keyQuestion: "?" },
  };
  const insights = m.buildInsights(sampleNews, [], [], experts, templates);
  assert.equal(insights.length, 2);
  assert.equal(insights[0].expertId, "pari");
  assert.equal(insights[0].tag, "opportunity");
  assert.match(insights[0].title, /Test Top news/);
  assert.ok(insights[0].relatedNewsIds.length >= 1);
});

test("buildInsights: expert에 template 없으면 스킵", () => {
  const experts = [
    { id: "pari", role: "x", name: "x" },
    { id: "ghost", role: "x", name: "x" }, // 템플릿 없음
  ];
  const templates = { pari: { tag: "opportunity", titleTemplate: "{topNewsTitle}", keyQuestion: "?" } };
  const insights = m.buildInsights(sampleNews, [], [], experts, templates);
  assert.equal(insights.length, 1);
  assert.equal(insights[0].expertId, "pari");
});

test("serialize: window.__DAILY__ 할당 형식", () => {
  const out = m.serialize({ date: "2026-01-01", news: [] });
  assert.match(out, /window\.__DAILY__ = /);
  assert.match(out, /AUTO-GENERATED/);
});

test("avgScore: utility", () => {
  assert.equal(m.avgScore({ scores: { impact: 4, freshness: 4, depth: 4, buzz: 4 } }), 4);
  assert.equal(m.avgScore({ scores: { impact: 0, freshness: 0, depth: 0, buzz: 0 } }), 0);
  assert.equal(m.avgScore(null), 0);
});

// ── End-to-end: 작은 합성 입력으로 build-today 실행 ────
test("end-to-end: collect mock → score → build-today → validate", () => {
  const tmpScored = path.join(ROOT, "tests", "tmp-scored.json");
  const tmpToday  = path.join(ROOT, "tests", "tmp-today.js");

  // 1. score 합성 입력
  fs.writeFileSync(tmpScored, JSON.stringify({
    scoredAt: new Date().toISOString(),
    windowHours: 24,
    counts: { news: 1, community: 0, oss: 0 },
    news: [{
      id: "n1", title: "Test news", category: "ai", url: "https://e.com",
      source: "openai", sourceCountry: "US", publishedAt: new Date().toISOString(),
      summary: "summary", scores: { impact: 5, freshness: 5, depth: 5, buzz: 5 }, tags: ["x"],
      featured: true, headline: false,
    }],
    community: [], oss: [],
  }));

  // 2. build-today 실행 (--no-validate — 작은 입력은 fiveLines warning만)
  const r = spawnSync("node", [
    path.join(ROOT, "scripts", "build-today.js"),
    `--in=${tmpScored}`, `--out=${tmpToday}`, "--no-validate",
  ], { encoding: "utf8" });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.ok(fs.existsSync(tmpToday));

  // 3. 출력이 유효한 JS — Function 격리로 평가
  const sandbox = { window: {} };
  new Function("window", fs.readFileSync(tmpToday, "utf8"))(sandbox.window);
  const D = sandbox.window.__DAILY__;
  assert.ok(D);
  assert.equal(D.news.length, 1);
  assert.equal(D.news[0].title, "Test news");
  assert.equal(D.conclusion.headline, "Test news");
  assert.ok(D.insights.length >= 1); // 시드의 insightTemplates 만큼

  fs.unlinkSync(tmpScored);
  fs.unlinkSync(tmpToday);
});
