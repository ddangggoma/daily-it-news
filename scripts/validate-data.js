#!/usr/bin/env node
/**
 * validate-data.js — Daily News data shape validator.
 *
 * 사용:
 *   node scripts/validate-data.js                  # validate data/today.js (default)
 *   node scripts/validate-data.js path/to/file.js  # validate any file
 *
 * 검증 대상 (window.__DAILY__):
 *   - 필수 top-level keys: date, generatedAt, conclusion, counts, fiveLines,
 *     quote, lead, stats, buckets, sourceDiversity, influencers, news[],
 *     community[], oss[], insights[]
 *   - news[]: id, title, category, url, source, sourceCountry, publishedAt,
 *     summary, scores{impact,freshness,depth,buzz}, tags[]
 *   - scores 4기준: number, 0..5
 *   - community[]: id, source, sourceLabel, sourceColor, title, url, points,
 *     category, author
 *   - oss[]: id, type, name, url, description, stars, starsThisWeek, language
 *   - insights[]: id, expertId, tag, title, excerpt, keyQuestion, analysis,
 *     relatedNewsIds[], relatedOssIds[], relatedCommunityIds[]
 *   - expertId가 __EXPERTS__에 존재 (referential integrity)
 *   - relatedXIds 모두 해당 array의 id에 존재 (referential integrity)
 *   - counts.{news,community,oss,insights} === array.length
 *
 * Exit code:
 *   0 = OK
 *   1 = validation errors (printed to stderr)
 *   2 = file/IO errors
 *
 * 의존: Node std lib만. CI/pre-commit/pre-publish 어디서나 실행 가능.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FILE = path.join(ROOT, "data", "today.js");
const EXPERTS_FILE = path.join(ROOT, "data", "experts.js");

const TARGET = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE;

// 카테고리 화이트리스트 (spec § 9)
const CATEGORIES = ["ai", "devtools", "ax", "robotics", "display", "design", "papers", "standards", "telecom"];
const INSIGHT_TAGS = ["opportunity", "pattern", "caution", "bullish"];
const SCORE_KEYS = ["impact", "freshness", "depth", "buzz"];

// ── 유틸 ───────────────────────────────────────────────
function loadGlobal(file, key) {
  if (!fs.existsSync(file)) throw Object.assign(new Error(`File not found: ${file}`), { code: "ENOENT" });
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  new Function("window", code)(sandbox.window);
  return sandbox.window[key];
}

function isStr(v)    { return typeof v === "string" && v.length > 0; }
function isNum(v)    { return typeof v === "number" && Number.isFinite(v); }
function isArr(v)    { return Array.isArray(v); }
function isObj(v)    { return v != null && typeof v === "object" && !Array.isArray(v); }
function inRange(v, lo, hi) { return isNum(v) && v >= lo && v <= hi; }
function isIso(v)    { return isStr(v) && !isNaN(Date.parse(v)); }
function isUrl(v)    { return isStr(v) && /^https?:\/\//.test(v); }

class ValidationErrors {
  constructor() { this.errors = []; this.warnings = []; }
  err(path, msg)  { this.errors.push(`${path}: ${msg}`); }
  warn(path, msg) { this.warnings.push(`${path}: ${msg}`); }
  get hasErrors() { return this.errors.length > 0; }
  report() {
    if (this.warnings.length) {
      console.warn(`⚠ ${this.warnings.length} warning(s):`);
      this.warnings.forEach((w) => console.warn(`  ${w}`));
    }
    if (this.hasErrors) {
      console.error(`✖ ${this.errors.length} validation error(s):`);
      this.errors.forEach((e) => console.error(`  ${e}`));
    } else {
      console.log("✓ data shape OK");
    }
  }
}

// ── 검증 ───────────────────────────────────────────────
function validateNews(items, V) {
  if (!isArr(items)) return V.err("news", "must be array");
  const seen = new Set();
  items.forEach((n, i) => {
    const p = `news[${i}]`;
    if (!isObj(n))                       return V.err(p, "not an object");
    if (!isStr(n.id))                       V.err(`${p}.id`, "missing/empty");
    else if (seen.has(n.id))                V.err(`${p}.id`, `duplicate "${n.id}"`);
    else                                    seen.add(n.id);
    if (!isStr(n.title))                    V.err(`${p}.title`, "missing/empty");
    if (!CATEGORIES.includes(n.category))   V.err(`${p}.category`, `invalid "${n.category}", expected one of [${CATEGORIES.join(",")}]`);
    if (!isUrl(n.url))                      V.err(`${p}.url`, "missing or not http(s)");
    if (!isStr(n.source))                   V.err(`${p}.source`, "missing");
    if (!isStr(n.sourceCountry))            V.err(`${p}.sourceCountry`, "missing");
    if (!isIso(n.publishedAt))              V.err(`${p}.publishedAt`, `invalid ISO date "${n.publishedAt}"`);
    if (!isStr(n.summary))                  V.err(`${p}.summary`, "missing");
    if (!isObj(n.scores))                   V.err(`${p}.scores`, "missing object");
    else SCORE_KEYS.forEach((k) => {
      if (!inRange(n.scores[k], 0, 5))      V.err(`${p}.scores.${k}`, `not number in [0..5]: ${n.scores[k]}`);
    });
    if (!isArr(n.tags))                     V.err(`${p}.tags`, "missing array");
    if (n.featured != null && typeof n.featured !== "boolean") V.warn(`${p}.featured`, "should be boolean");
    if (n.headline != null && typeof n.headline !== "boolean") V.warn(`${p}.headline`, "should be boolean");
  });
  return seen;
}

function validateCommunity(items, V) {
  if (!isArr(items)) return V.err("community", "must be array");
  const seen = new Set();
  items.forEach((c, i) => {
    const p = `community[${i}]`;
    if (!isObj(c)) return V.err(p, "not an object");
    if (!isStr(c.id))                     V.err(`${p}.id`, "missing/empty");
    else if (seen.has(c.id))              V.err(`${p}.id`, `duplicate "${c.id}"`);
    else                                  seen.add(c.id);
    if (!isStr(c.source))                 V.err(`${p}.source`, "missing");
    if (!isStr(c.sourceLabel))            V.err(`${p}.sourceLabel`, "missing");
    if (!isStr(c.sourceColor))            V.err(`${p}.sourceColor`, "missing");
    if (!isStr(c.title))                  V.err(`${p}.title`, "missing");
    if (!isUrl(c.url))                    V.err(`${p}.url`, "missing or not http(s)");
    if (!isNum(c.points))                 V.err(`${p}.points`, "not number");
    if (!CATEGORIES.includes(c.category)) V.err(`${p}.category`, `invalid "${c.category}"`);
    if (!isStr(c.author))                 V.warn(`${p}.author`, "missing");
  });
  return seen;
}

function validateOss(items, V) {
  if (!isArr(items)) return V.err("oss", "must be array");
  const seen = new Set();
  items.forEach((o, i) => {
    const p = `oss[${i}]`;
    if (!isObj(o)) return V.err(p, "not an object");
    if (!isStr(o.id))                  V.err(`${p}.id`, "missing/empty");
    else if (seen.has(o.id))           V.err(`${p}.id`, `duplicate "${o.id}"`);
    else                               seen.add(o.id);
    if (!isStr(o.type))                V.err(`${p}.type`, "missing");
    if (!isStr(o.name))                V.err(`${p}.name`, "missing");
    if (!isUrl(o.url))                 V.err(`${p}.url`, "missing or not http(s)");
    if (!isStr(o.description))         V.err(`${p}.description`, "missing");
    if (!isNum(o.stars))               V.err(`${p}.stars`, "not number");
    if (!isNum(o.starsThisWeek))       V.err(`${p}.starsThisWeek`, "not number");
    if (o.starsThisWeek > o.stars)     V.warn(`${p}.starsThisWeek`, `(${o.starsThisWeek}) > stars (${o.stars}) — sanity flag`);
    if (!isStr(o.language))            V.warn(`${p}.language`, "missing");
  });
  return seen;
}

function validateInsights(items, V, refs) {
  if (!isArr(items)) return V.err("insights", "must be array");
  const seen = new Set();
  items.forEach((it, i) => {
    const p = `insights[${i}]`;
    if (!isObj(it)) return V.err(p, "not an object");
    if (!isStr(it.id))                          V.err(`${p}.id`, "missing/empty");
    else if (seen.has(it.id))                   V.err(`${p}.id`, `duplicate "${it.id}"`);
    else                                        seen.add(it.id);
    if (!isStr(it.expertId))                    V.err(`${p}.expertId`, "missing");
    else if (!refs.expertIds.has(it.expertId))  V.err(`${p}.expertId`, `"${it.expertId}" not found in __EXPERTS__`);
    if (!INSIGHT_TAGS.includes(it.tag))         V.err(`${p}.tag`, `invalid "${it.tag}", expected one of [${INSIGHT_TAGS.join(",")}]`);
    if (!isStr(it.title))                       V.err(`${p}.title`, "missing");
    if (!isStr(it.excerpt))                     V.err(`${p}.excerpt`, "missing");
    if (!isStr(it.keyQuestion))                 V.err(`${p}.keyQuestion`, "missing");
    if (!isStr(it.analysis))                    V.err(`${p}.analysis`, "missing");
    // Referential integrity
    ["relatedNewsIds:newsIds", "relatedOssIds:ossIds", "relatedCommunityIds:communityIds"].forEach((pair) => {
      const [field, refKey] = pair.split(":");
      const arr = it[field];
      if (arr == null) return; // optional
      if (!isArr(arr)) return V.err(`${p}.${field}`, "must be array");
      arr.forEach((id, j) => {
        if (!refs[refKey].has(id)) V.err(`${p}.${field}[${j}]`, `id "${id}" not in ${refKey.replace("Ids", "[]")}`);
      });
    });
  });
  return seen;
}

function validateTopLevel(D, V) {
  ["date", "generatedAt", "conclusion", "counts", "fiveLines", "quote", "lead", "stats",
   "buckets", "sourceDiversity", "influencers", "news", "community", "oss", "insights"].forEach((k) => {
    if (D[k] == null) V.err(`__DAILY__.${k}`, "missing");
  });

  // conclusion
  if (isObj(D.conclusion)) {
    if (!isStr(D.conclusion.headline))  V.err("conclusion.headline", "missing");
    if (!isNum(D.conclusion.scoreAvg))  V.err("conclusion.scoreAvg", "not number");
    if (D.conclusion.vs7d != null && !isNum(D.conclusion.vs7d)) V.err("conclusion.vs7d", "not number");
  }

  // sourceDiversity
  if (isArr(D.sourceDiversity)) {
    let total = 0;
    D.sourceDiversity.forEach((s, i) => {
      const p = `sourceDiversity[${i}]`;
      if (!isStr(s.region))         V.err(`${p}.region`, "missing");
      if (!inRange(s.percent, 0, 100)) V.err(`${p}.percent`, "not 0..100");
      else total += s.percent;
      if (!isStr(s.color))          V.warn(`${p}.color`, "missing");
    });
    if (Math.abs(total - 100) > 1.5) V.warn("sourceDiversity total", `sums to ${total}%, expected ~100%`);
  }

  // fiveLines
  if (isArr(D.fiveLines)) {
    if (D.fiveLines.length !== 5) V.warn("fiveLines.length", `expected 5, got ${D.fiveLines.length}`);
    D.fiveLines.forEach((l, i) => {
      if (!isStr(l.text)) V.err(`fiveLines[${i}].text`, "missing");
    });
  }
}

function validateCounts(D, V, sets) {
  if (!isObj(D.counts)) return;
  const pairs = [
    ["news",      sets.newsIds],
    ["community", sets.communityIds],
    ["oss",       sets.ossIds],
    ["insights",  sets.insightIds],
  ];
  // STRICT GATE: counts MUST equal array length (else dashboard tab badge lies to users).
  // History: this was V.warn (silent pass), but the autonomous-session pipeline build-today.js
  // hardcoded counts.insights = 10 — the exact silent-failure pattern this project's
  // /plan-eng-review identified as A2. Promoted to V.err so build-today.js fails loud
  // when counts and array length diverge.
  // Fixture data with intentional mismatch should set counts to array length, not the
  // display target.
  pairs.forEach(([k, set]) => {
    if (!isNum(D.counts[k])) return V.err(`counts.${k}`, "not number");
    if (D.counts[k] !== set.size) {
      V.err(`counts.${k}`, `${D.counts[k]} ≠ ${set.size} (array length). Display tab badge would mislead users; build-today.js should set counts from arrays.`);
    }
  });
}

// ── 메인 ──────────────────────────────────────────────
function main() {
  console.log(`Validating ${path.relative(process.cwd(), TARGET)}`);
  const V = new ValidationErrors();
  let D, expertIds;

  try {
    D = loadGlobal(TARGET, "__DAILY__");
    if (!D) { V.err("__DAILY__", "global not set after loading file"); V.report(); process.exit(1); }
  } catch (err) {
    if (err.code === "ENOENT") { console.error(`✖ ${err.message}`); process.exit(2); }
    console.error(`✖ failed to load: ${err.message}`); process.exit(2);
  }

  try {
    const experts = loadGlobal(EXPERTS_FILE, "__EXPERTS__") || [];
    expertIds = new Set(experts.map((e) => e.id));
  } catch (err) {
    V.warn("experts", `could not load __EXPERTS__: ${err.message}`);
    expertIds = new Set();
  }

  validateTopLevel(D, V);
  const newsIds      = validateNews(D.news, V) || new Set();
  const communityIds = validateCommunity(D.community, V) || new Set();
  const ossIds       = validateOss(D.oss, V) || new Set();
  const insightIds   = validateInsights(D.insights, V, { expertIds, newsIds, ossIds, communityIds }) || new Set();
  validateCounts(D, V, { newsIds, communityIds, ossIds, insightIds });

  V.report();
  if (V.hasErrors) process.exit(1);
}

if (require.main === module) main();

module.exports = { loadGlobal, ValidationErrors, CATEGORIES, INSIGHT_TAGS, SCORE_KEYS };
