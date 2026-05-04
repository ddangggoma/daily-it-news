/**
 * generate-feed.test.js — node:test suite for scripts/generate-feed.js
 *
 * Run:  node --test tests/unit/generate-feed.test.js
 *
 * 검증:
 *   - feed.xml 생성 후 28 items (18 news + 10 insights)
 *   - 모든 필수 channel 메타 (title, link, atom:link, language)
 *   - news item: title, link, pubDate, guid, category, 4기준 점수 description
 *   - insights item: [인사이트] 접두 + tag category
 *   - XML escape: &, <, >, ", ' 5종 정확
 *   - RFC822 pubDate 패턴
 *   - Function-isolated loadDaily (window 미오염)
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "generate-feed.js");
const FEED   = path.join(ROOT, "feed.xml");

function runGenerator(env) {
  return spawnSync("node", [SCRIPT], { encoding: "utf8", env: { ...process.env, ...(env || {}) } });
}

function readFeed() { return fs.readFileSync(FEED, "utf8"); }

// ── 1. 실행 + 기본 형태 ──────────────────────────────────
test("generator runs and writes feed.xml (exit 0)", () => {
  const r = runGenerator();
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /\[generate-feed\] wrote feed\.xml.*\d+ news.*\d+ insights/);
  assert.ok(fs.existsSync(FEED));
});

test("feed.xml is valid RSS 2.0", () => {
  const xml = readFeed();
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.match(xml, /<\/channel>\s*<\/rss>\s*$/);
});

test("channel has required metadata", () => {
  const xml = readFeed();
  assert.match(xml, /<channel>/);
  assert.match(xml, /<title>Daily News<\/title>/);
  assert.match(xml, /<atom:link href="[^"]+feed\.xml" rel="self"/);
  assert.match(xml, /<language>ko-kr<\/language>/);
  assert.match(xml, /<lastBuildDate>[^<]+<\/lastBuildDate>/);
  assert.match(xml, /<pubDate>[^<]+<\/pubDate>/);
});

// ── 2. 카운트 (data와 일치) ─────────────────────────────
test("item count = news.length + insights.length", () => {
  const xml = readFeed();
  const itemCount = (xml.match(/<item>/g) || []).length;

  // data/today.js 직접 로드해서 기대 카운트 계산
  const daily = require(path.join(ROOT, "scripts", "generate-feed.js")).loadDaily();
  const expected = (daily.news || []).length + (daily.insights || []).length;
  assert.equal(itemCount, expected);
});

// ── 3. RFC 822 pubDate 패턴 ─────────────────────────────
test("pubDate is RFC 822 (Date.toUTCString format)", () => {
  const xml = readFeed();
  // RFC 822: "Fri, 01 May 2026 13:30:00 GMT" — Node Date.toUTCString output
  const RFC822 = /<pubDate>(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT<\/pubDate>/;
  const matches = xml.match(/<pubDate>[^<]+<\/pubDate>/g) || [];
  assert.ok(matches.length >= 2, "expected at least channel + 1 item pubDate");
  matches.forEach((m) => assert.match(m, RFC822));
});

// ── 4. 뉴스 item 구조 ───────────────────────────────────
test("news item has title, link, pubDate, guid, category", () => {
  const xml = readFeed();
  // 첫 <item> 블록 추출
  const m = xml.match(/<item>[\s\S]*?<\/item>/);
  assert.ok(m, "no <item> found");
  const item = m[0];
  assert.match(item, /<title>[^<]+<\/title>/);
  assert.match(item, /<link>[^<]+<\/link>/);
  assert.match(item, /<pubDate>[^<]+<\/pubDate>/);
  assert.match(item, /<guid isPermaLink="false">[^<]+<\/guid>/);
  assert.match(item, /<category>[^<]+<\/category>/);
});

test("news description includes 4-criteria scores", () => {
  const xml = readFeed();
  // 첫 news item description에 [4기준 점수] impact=... freshness=... depth=... buzz=...
  const desc = (xml.match(/<description>[\s\S]*?<\/description>/g) || [])[1]; // 0=channel, 1=first item
  assert.ok(desc, "no item description found");
  assert.match(desc, /4기준 점수/);
  assert.match(desc, /impact=\d+\.\d/);
  assert.match(desc, /freshness=\d+\.\d/);
  assert.match(desc, /depth=\d+\.\d/);
  assert.match(desc, /buzz=\d+\.\d/);
});

// ── 5. 인사이트 item 구조 ───────────────────────────────
test("insight items prefixed with [인사이트]", () => {
  const xml = readFeed();
  const insightTitles = xml.match(/<title>\[인사이트\][^<]+<\/title>/g) || [];
  // Round 3: 10 → 20 insights (삼성전자 임원진 페르소나로 확장).
  // 임의의 카운트가 아닌 today.js 의 insights 길이와 동기화되어야 함.
  assert.equal(insightTitles.length, 20, `expected 20 insight items, got ${insightTitles.length}`);
});

test("insight items have category=insight + tag", () => {
  const xml = readFeed();
  // 첫 인사이트 item 찾기
  const insightItem = xml.match(/<item>[\s\S]*?\[인사이트\][\s\S]*?<\/item>/);
  assert.ok(insightItem, "no insight item found");
  const it = insightItem[0];
  assert.match(it, /<category>insight<\/category>/);
  assert.match(it, /<category>(opportunity|pattern|caution|bullish)<\/category>/);
});

// ── 6. XML escape 정확성 ────────────────────────────────
test("XML escape: 5 special characters all encoded", () => {
  // 합성 데이터에 모든 특수문자 포함
  const tmpFile = path.join(ROOT, "tests", "fixtures", "xml-escape.tmp.js");
  fs.writeFileSync(tmpFile, `
window.__DAILY__ = {
  date: "2026-01-01", generatedAt: "2026-01-01T06:00:00+09:00",
  conclusion: { headline: "OK", scoreAvg: 4.5, vs7d: 0 },
  counts: { news: 1, community: 0, oss: 0, insights: 0 },
  fiveLines: [{ text: "x" }],
  quote: { text: "q", author: "a", role: "r", url: "https://e.com" },
  lead: "l", stats: {}, buckets: {}, sourceDiversity: [], influencers: [],
  community: [], oss: [], insights: [],
  news: [{
    id: "n1",
    title: "Tom & Jerry's <hat> says \\"hi\\" 'world'",
    category: "ai",
    url: "https://example.com/?a=1&b=2",
    source: "S",
    sourceCountry: "US",
    publishedAt: "2026-01-01T10:00:00+09:00",
    summary: "& < > \\" ' all here",
    scores: { impact: 5, freshness: 5, depth: 5, buzz: 5 },
    tags: ["a&b"],
  }],
};
`);
  // generate-feed.js의 newsItem 직접 호출
  const m = require(SCRIPT);
  const daily = m.loadDaily();
  // tmpFile을 DAILY로 사용하기 위해 수동 평가
  const sandbox = { window: {} };
  new Function("window", fs.readFileSync(tmpFile, "utf8"))(sandbox.window);
  const xml = m.newsItem(sandbox.window.__DAILY__.news[0]);

  // 5종 escape 모두 적용
  assert.match(xml, /Tom &amp; Jerry/);
  assert.match(xml, /&lt;hat&gt;/);
  assert.match(xml, /&quot;hi&quot;/);
  assert.match(xml, /&apos;world&apos;/);
  assert.match(xml, /\?a=1&amp;b=2/);
  assert.match(xml, /a&amp;b/);
  // 원래 raw 문자가 안 나와야 함
  assert.doesNotMatch(xml, /<hat>/);

  fs.unlinkSync(tmpFile);
});

// ── 7. 환경변수 사이트 URL ──────────────────────────────
test("DN_SITE_URL env var overrides default", () => {
  const r = runGenerator({ DN_SITE_URL: "https://daily.example.com/" });
  assert.equal(r.status, 0);
  const xml = readFeed();
  assert.match(xml, /https:\/\/daily\.example\.com\//);
  assert.doesNotMatch(xml, /daily-news\.local/);
});

// 정리: 기본값으로 다시 생성해서 다른 테스트가 영향 안 받게
test.after(() => {
  spawnSync("node", [SCRIPT], { encoding: "utf8" });
});

// ── 8. Function-isolated loadDaily (window 미오염) ─────
test("loadDaily isolates window — no global pollution", () => {
  const m = require(SCRIPT);
  const D = m.loadDaily();
  assert.ok(D);
  assert.ok(typeof D.lead === "string");
  // global window must NOT be polluted
  assert.equal(typeof global.window, "undefined");
});
