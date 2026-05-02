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
  assert.equal(c.scoreAvg, 4); // (5+3)/2 = 4
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

test("buildStats: counts categories + 4.5+ items", () => {
  const news = [
    { category: "ai",       scores: { impact: 5, freshness: 5, depth: 5, buzz: 5 } },
    { category: "robotics", scores: { impact: 3, freshness: 3, depth: 3, buzz: 3 } },
    { category: "ai",       scores: { impact: 4.6, freshness: 4.6, depth: 4.6, buzz: 4.6 } },
  ];
  const s = m.buildStats(news);
  assert.equal(s.newsTotal, 3);
  assert.equal(s.score45plus, 2); // 5+ and 4.6+
  assert.equal(s.categoriesActive, 2); // ai, robotics
  assert.equal(s.insights, 10);
});

test("buildBuckets: 어제/오늘/기록용 분류", () => {
  const now = new Date();
  const today = now.toISOString();
  const yesterday = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
  const old = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString();
  const items = [
    { publishedAt: today },
    { publishedAt: yesterday },
    { publishedAt: yesterday },
    { publishedAt: old },
  ];
  const b = m.buildBuckets(items, now.toISOString());
  assert.equal(b.today.count, 1);
  assert.equal(b.yesterday.count, 2);
  assert.equal(b.archival.count, 1);
  assert.equal(b.all.count, 4);
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
