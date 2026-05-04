/**
 * spec-drift.test.js — Asserts scripts/util.js (browser) and scripts/spec.js
 * (Node) declare the same enums.
 *
 * util.js can't `require()` — it's a no-build static <script> for file://
 * compatibility. So we keep two physical copies and use this test to catch
 * drift. If you change scripts/spec.js, mirror the change in
 * scripts/util.js (the CATEGORIES + INSIGHT_TAGS objects exposed via
 * window.DN). The test uses _io.js's Function-isolation trick to load
 * util.js as if it were browser code.
 *
 * Closes /ce-code-review maintainability M2.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const SPEC = require(path.join(ROOT, "scripts", "spec.js"));
const { loadBrowserGlobal } = require(path.join(ROOT, "scripts", "_io.js"));

// Load util.js the way the browser would, via Function-isolation.
const DN = loadBrowserGlobal(path.join(ROOT, "scripts", "util.js"), "DN");

test("CATEGORIES: same keys + same icons + same labels in util.js and spec.js", () => {
  assert.equal(DN.CATEGORIES.length, SPEC.CATEGORIES.length);
  for (let i = 0; i < SPEC.CATEGORIES.length; i++) {
    const node = SPEC.CATEGORIES[i];
    const browser = DN.CATEGORIES[i];
    assert.equal(browser.key, node.key, `CATEGORIES[${i}].key drift`);
    assert.equal(browser.icon, node.icon, `CATEGORIES[${i}].icon drift`);
    assert.equal(browser.label, node.label, `CATEGORIES[${i}].label drift`);
  }
});

test("INSIGHT_TAGS: same keys + same labels in util.js and spec.js", () => {
  const nodeKeys = Object.keys(SPEC.INSIGHT_TAGS).sort();
  const browserKeys = Object.keys(DN.INSIGHT_TAGS).sort();
  assert.deepEqual(browserKeys, nodeKeys);
  for (const k of nodeKeys) {
    assert.equal(DN.INSIGHT_TAGS[k].label, SPEC.INSIGHT_TAGS[k].label, `INSIGHT_TAGS.${k}.label drift`);
    assert.equal(DN.INSIGHT_TAGS[k].color, SPEC.INSIGHT_TAGS[k].color, `INSIGHT_TAGS.${k}.color drift`);
  }
});

test("INSIGHT_TAG_KEYS subset: spec.js keys are exactly the four tags validate-data accepts", () => {
  assert.deepEqual([...SPEC.INSIGHT_TAG_KEYS].sort(), ["bullish", "caution", "opportunity", "pattern"]);
});

test("CATEGORY_KEYS: Round 9 — 8 기본 + 5 추가 + 2 research = 15 카테고리", () => {
  // 사용자 요청 (Round 9): "AI, Dev Tools, AX, 로봇, 디스플레이, 디자인, 통신, 데이터는 기본 포함"
  // 기본 8개 + 추가 5개 (security/cloud/semiconductor/mobile/startup) + research 2개 (papers/standards).
  assert.deepEqual([...SPEC.CATEGORY_KEYS].sort(), [
    "ai", "ax", "cloud", "data", "design", "devtools", "display", "mobile",
    "papers", "robotics", "security", "semiconductor", "standards", "startup", "telecom",
  ]);
});
