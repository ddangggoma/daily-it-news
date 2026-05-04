/**
 * validate-data.test.js — node:test suite for scripts/validate-data.js
 *
 * Run:  node --test tests/unit/validate-data.test.js
 *
 * 검증:
 *   1. 정상 data/today.js → exit 0
 *   2. 합성 broken fixture → exit 1
 *   3. 누락 파일 → exit 2
 *   4. 각 검증 룰: duplicate id, invalid category, bad url, out-of-range
 *      scores, missing fields, ghost expertId, dangling relatedXIds
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..", "..");
const VALIDATOR = path.join(ROOT, "scripts", "validate-data.js");
const TODAY     = path.join(ROOT, "data", "today.js");
const BROKEN    = path.join(ROOT, "tests", "fixtures", "broken.js");

function run(file) {
  const res = spawnSync("node", [VALIDATOR, file], { encoding: "utf8" });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

// ── exit code contract ───────────────────────────────────
test("exit 0 on valid data/today.js", () => {
  const r = run(TODAY);
  assert.equal(r.code, 0, `expected 0, got ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.match(r.stdout, /✓ data shape OK/);
});

test("exit 1 on broken fixture", () => {
  const r = run(BROKEN);
  assert.equal(r.code, 1, `expected 1, got ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
});

test("exit 2 on missing file", () => {
  const r = run(path.join(ROOT, "no-such-file.js"));
  assert.equal(r.code, 2);
});

// ── 개별 룰: broken fixture가 어떤 에러를 잡아내는가 ─────
test("broken fixture detects: duplicate id", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /duplicate "n01"/);
});

test("broken fixture detects: invalid category", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /invalid "invalid-category"/);
});

test("broken fixture detects: non-http url", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /not http\(s\)/);
});

test("broken fixture detects: invalid ISO date", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /invalid ISO date/);
});

test("broken fixture detects: scores out of range", () => {
  const r = run(BROKEN);
  // score=6 (impact) and score=-1 (depth)
  assert.match(r.stderr, /scores\.impact.*not number in \[0\.\.5\]: 6/);
  assert.match(r.stderr, /scores\.depth.*not number in \[0\.\.5\]: -1/);
});

test("broken fixture detects: ghost expertId (referential integrity)", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /expertId.*"ghost" not found in __EXPERTS__/);
});

test("broken fixture detects: dangling relatedNewsIds", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /relatedNewsIds\[0\].*"n99" not in news\[\]/);
});

test("broken fixture detects: invalid insight tag", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /invalid "wrong-tag"/);
});

test("broken fixture detects: scoreAvg not number", () => {
  const r = run(BROKEN);
  assert.match(r.stderr, /conclusion\.scoreAvg.*not number/);
});

// ── counts mismatch is now ERROR (was warn) — daily-publish의 silent UI lie 차단 ──
test("today.js passes validation (counts === array length post-fix)", () => {
  const r = run(TODAY);
  assert.equal(r.code, 0, `expected today.js to pass validation post-fix; got ${r.code}\nstderr: ${r.stderr}`);
});

test("counts mismatch is now ERROR not warning (daily-publish gate)", () => {
  const r = run(BROKEN);
  assert.equal(r.code, 1);
  // broken fixture has counts.news=99 vs news.length=2 — must be reported as error
  assert.match(r.stderr, /counts\.news.*≠.*array length/);
});

// ── 모듈 직접 import: helpers ────────────────────────────
test("module exports: CATEGORIES, INSIGHT_TAGS, SCORE_KEYS", () => {
  const m = require(VALIDATOR);
  // Round 9: 9 → 15 카테고리 (8 기본 + 5 추가 + 2 research 별도 탭)
  assert.ok(Array.isArray(m.CATEGORIES) && m.CATEGORIES.length === 15);
  assert.ok(Array.isArray(m.INSIGHT_TAGS) && m.INSIGHT_TAGS.length === 4);
  assert.deepEqual(m.SCORE_KEYS, ["impact", "freshness", "depth", "buzz"]);
});

test("module exports: loadGlobal isolates window", () => {
  const m = require(VALIDATOR);
  const D = m.loadGlobal(TODAY, "__DAILY__");
  assert.ok(D);
  assert.ok(typeof D.lead === "string");
  // global window must NOT be polluted
  assert.equal(typeof global.window, "undefined");
});
