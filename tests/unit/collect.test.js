/**
 * collect.test.js — unit tests for scripts/collect.js
 *
 * Run:  node --test tests/unit/collect.test.js
 *
 * Network 의존 없이 mock + RSS parser 단위 테스트만 검증.
 * 실제 fetch 동작은 별도 integration 테스트에서 (현재 스코프 외).
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "collect.js");
const TMP_OUT = path.join(ROOT, "data", "raw-collection.test.json");

const m = require(SCRIPT);

test("hintCategory detects AI from common keywords", () => {
  assert.equal(m.hintCategory("OpenAI Agents API GA"), "ai");
  assert.equal(m.hintCategory("Llama reasoning mode"), "ai");
  assert.equal(m.hintCategory("Claude inference benchmark"), "ai");
});

test("hintCategory detects robotics", () => {
  assert.equal(m.hintCategory("Tesla Optimus humanoid demo"), "robotics");
  assert.equal(m.hintCategory("Boston Dynamics new robot"), "robotics");
});

test("hintCategory detects display + telecom + papers", () => {
  assert.equal(m.hintCategory("Samsung foldable OLED yield"), "display");
  assert.equal(m.hintCategory("5G fiber broadband expansion"), "telecom");
  assert.equal(m.hintCategory("New arxiv paper on transformers"), "papers");
});

test("hintCategory returns undefined for non-IT text", () => {
  assert.equal(m.hintCategory("Today the weather is nice"), undefined);
  assert.equal(m.hintCategory(""), undefined);
  assert.equal(m.hintCategory(null), undefined);
});

test("parseRss handles RSS 2.0 single item", () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <item>
        <title>Hello</title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 01 May 2026 13:30:00 GMT</pubDate>
        <description><![CDATA[<p>summary</p>]]></description>
        <category>ai</category>
        <category>llm</category>
      </item>
    </channel></rss>`;
  const items = m.parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Hello");
  assert.equal(items[0].link, "https://example.com/a");
  assert.match(items[0].pubDate, /Fri, 01 May 2026/);
  assert.match(items[0].description, /<p>summary<\/p>/); // CDATA stripped, HTML preserved
  assert.deepEqual(items[0].categories, ["ai", "llm"]);
});

test("parseRss handles Atom <entry>", () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Atom Hi</title>
        <link href="https://atom.example/a" />
        <published>2026-05-01T22:30:00Z</published>
        <summary>brief</summary>
      </entry>
    </feed>`;
  const items = m.parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Atom Hi");
  assert.equal(items[0].link, "https://atom.example/a");
  assert.equal(items[0].pubDate, "2026-05-01T22:30:00Z");
  assert.equal(items[0].description, "brief");
});

test("parseRss handles empty feed", () => {
  const xml = `<rss><channel></channel></rss>`;
  assert.deepEqual(m.parseRss(xml), []);
});

test("--mock flag reads tests/fixtures/raw-collection.json", () => {
  const r = spawnSync("node", [SCRIPT, "--mock", `--out=${TMP_OUT}`], { encoding: "utf8" });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.match(r.stdout, /\[collect\] wrote/);

  const out = JSON.parse(fs.readFileSync(TMP_OUT, "utf8"));
  assert.ok(Array.isArray(out.items));
  assert.ok(out.items.length >= 1);
  // mock 데이터의 첫 항목 확인
  assert.equal(out.items[0].source, "hackernews");
  assert.equal(out.items[0].domain, "community");

  fs.unlinkSync(TMP_OUT);
});

test("SOURCE_META covers expected sources", () => {
  assert.ok(m.SOURCE_META.hackernews);
  assert.ok(m.SOURCE_META.github_trending);
  assert.ok(m.SOURCE_META.techcrunch);
  // 각 소스가 label/color/country/domain 보유
  Object.values(m.SOURCE_META).forEach((meta) => {
    assert.ok(meta.label && meta.color && meta.country && meta.domain);
  });
});
