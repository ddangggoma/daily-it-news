/**
 * score.test.js — node:test for scripts/score.js
 *
 * 4기준 휴리스틱이 합리적 범위 내에서 동작하는지 검증.
 * LLM 호출 경로는 ANTHROPIC_API_KEY 의존이라 unit test 범위 외.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const m = require(path.join(ROOT, "scripts", "score.js"));

const baseItem = {
  id: "x", domain: "news", source: "techcrunch",
  title: "Test", summary: "summary",
  publishedAt: new Date(Date.now() - 1000).toISOString(), // 1초 전
  points: 0, tags: [],
};

test("scoreImpact: high-authority + GA keyword → high", () => {
  const s = m.scoreImpact({ ...baseItem, source: "openai", title: "Agents API GA" });
  assert.ok(s >= 4.5, `expected ≥4.5, got ${s}`);
});

test("scoreImpact: unknown source + bland title → moderate", () => {
  const s = m.scoreImpact({ ...baseItem, source: "rando", title: "Just an article" });
  assert.ok(s >= 2 && s <= 4, `expected 2..4, got ${s}`);
});

test("scoreFreshness: just now → 5", () => {
  const s = m.scoreFreshness({ publishedAt: new Date().toISOString() }, 24);
  assert.ok(s >= 4.5, `expected ≥4.5, got ${s}`);
});

test("scoreFreshness: 12h ago in 24h window → ~3", () => {
  const past = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const s = m.scoreFreshness({ publishedAt: past }, 24);
  assert.ok(s >= 2.5 && s <= 3.5, `expected ~3, got ${s}`);
});

test("scoreFreshness: way past window → near 0", () => {
  const past = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const s = m.scoreFreshness({ publishedAt: past }, 24);
  assert.ok(s <= 1, `expected ≤1, got ${s}`);
});

test("scoreFreshness: invalid date → 0", () => {
  assert.equal(m.scoreFreshness({ publishedAt: "not-a-date" }, 24), 0);
  assert.equal(m.scoreFreshness({}, 24), 0);
});

test("scoreDepth: technical keywords → boost", () => {
  const technical = m.scoreDepth({
    domain: "news",
    title: "New transformer architecture benchmark",
    summary: "p99 latency improvements in inference SDK with attention mechanism",
  });
  const bland = m.scoreDepth({
    domain: "news",
    title: "Casual news article",
    summary: "x",
  });
  assert.ok(technical > bland, `technical ${technical} should > bland ${bland}`);
});

test("scoreDepth: oss domain bonus", () => {
  const oss = m.scoreDepth({ domain: "oss", title: "x", summary: "x" });
  const community = m.scoreDepth({ domain: "community", title: "x", summary: "x" });
  assert.ok(oss > community);
});

test("scoreBuzz: log scale of points", () => {
  assert.ok(m.scoreBuzz({ points: 0 }) <= 2);
  assert.ok(m.scoreBuzz({ points: 100 }) >= 3);
  assert.ok(m.scoreBuzz({ points: 5000 }) >= 4.5);
});

test("scoreBuzz: monotonic — more points always ≥ less points", () => {
  let prev = -Infinity;
  for (const pts of [0, 1, 10, 100, 1000, 10000, 100000]) {
    const s = m.scoreBuzz({ points: pts });
    assert.ok(s >= prev, `non-monotonic at ${pts}: ${s} < ${prev}`);
    prev = s;
  }
});

test("shapeForDashboard: news output schema", () => {
  const item = { ...baseItem, domain: "news", rawCategory: "ai", sourceCountry: "US" };
  const scores = { impact: 5, freshness: 5, depth: 5, buzz: 5 };
  const out = m.shapeForDashboard(item, scores);
  assert.equal(out.id, "x");
  assert.equal(out.category, "ai");
  assert.equal(out.sourceCountry, "US");
  assert.deepEqual(out.scores, scores);
  assert.equal(typeof out.featured, "boolean");
  assert.equal(out.headline, false);
});

test("shapeForDashboard: news featured true at score sum >= 18", () => {
  const item = { ...baseItem, domain: "news", rawCategory: "ai", sourceCountry: "US" };
  const big = m.shapeForDashboard(item, { impact: 5, freshness: 5, depth: 5, buzz: 5 }); // 20
  const small = m.shapeForDashboard(item, { impact: 3, freshness: 3, depth: 3, buzz: 3 }); // 12
  assert.equal(big.featured, true);
  assert.equal(small.featured, false);
});

test("shapeForDashboard: oss output has type detection", () => {
  const item = { ...baseItem, domain: "oss", title: "openai/agents-python",
                 summary: "multi-agent runtime", points: 1000 };
  const out = m.shapeForDashboard(item, { impact: 4, freshness: 4, depth: 4, buzz: 4 });
  assert.equal(out.type, "agent");
  assert.equal(out.typeIcon, "🤖");
  assert.equal(out.stars, 1000);
});

test("shapeForDashboard: oss type fallback to 'tool'", () => {
  const item = { ...baseItem, domain: "oss", title: "x/y", summary: "no specific keyword" };
  const out = m.shapeForDashboard(item, { impact: 0, freshness: 0, depth: 0, buzz: 0 });
  assert.equal(out.type, "tool");
});

test("detectOssType covers all spec types", () => {
  assert.equal(m.detectOssType({ title: "agent", summary: "" }), "agent");
  assert.equal(m.detectOssType({ title: "framework x", summary: "" }), "framework");
  assert.equal(m.detectOssType({ title: "library", summary: "" }), "library");
  assert.equal(m.detectOssType({ title: "model x", summary: "" }), "model");
  assert.equal(m.detectOssType({ title: "dataset", summary: "" }), "dataset");
  assert.equal(m.detectOssType({ title: "runtime", summary: "" }), "runtime");
  assert.equal(m.detectOssType({ title: "miscellaneous", summary: "" }), "tool");
});

test("SOURCE_AUTHORITY tiers", () => {
  assert.ok(m.SOURCE_AUTHORITY.openai >= 4.5);
  assert.ok(m.SOURCE_AUTHORITY.techcrunch >= 4);
  assert.ok(m.SOURCE_AUTHORITY._default >= 3);
});
