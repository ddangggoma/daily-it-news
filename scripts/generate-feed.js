#!/usr/bin/env node
/**
 * generate-feed.js — Daily News RSS 2.0 생성기.
 *
 * 사용:
 *   node scripts/generate-feed.js
 *
 * 동작:
 *   - data/today.js 를 읽고 (브라우저용 `window.__DAILY__ = {...}` 형식) 평가
 *   - 뉴스 + (선택) 인사이트를 RSS 2.0 <item> 으로 직렬화
 *   - feed.xml 을 프로젝트 루트에 작성 (덮어쓰기)
 *
 * 일일 발행 파이프라인이 매 06:00 KST에 today.js 갱신 후 이 스크립트를 호출.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
const { loadBrowserGlobal } = require("./_io");

const ROOT = path.resolve(__dirname, "..");
const SRC  = path.join(ROOT, "data", "today.js");
const DEST = path.join(ROOT, "feed.xml");

// 사이트 메타 (실제 도메인 확정 시 환경변수로 교체)
const SITE = {
  url:         process.env.DN_SITE_URL  || "https://daily-news.local/",
  title:       "Daily News",
  description: "어제 24h IT × 4기준 점수 × 10인 분야 전문가 분석",
  language:    "ko-kr",
  generator:   "Daily News RSS Generator (Node " + process.versions.node + ")",
  copyright:   "© Daily News",
};

// ── 1. today.js 평가 (Function 격리 — _io.js의 단일 구현 사용) ──
function loadDaily() {
  const D = loadBrowserGlobal(SRC, "__DAILY__");
  if (!D) throw new Error("data/today.js 가 window.__DAILY__ 를 설정하지 않았습니다.");
  return D;
}

// ── 2. XML 안전 ─────────────────────────────────────────
function xe(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(iso) {
  // Invalid input: return epoch (1970-01-01) instead of silently substituting
  // "now". An RSS reader sees an obviously wrong date and dedups the item, vs.
  // the previous behavior which republished bad dates as "fresh" every run.
  // Closes testing P2 #28.
  if (!iso) return new Date().toUTCString();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date(0).toUTCString();
  return d.toUTCString();
}

// ── 3. RSS <item> 생성 ─────────────────────────────────
function newsItem(n) {
  const guid = `${SITE.url}#${n.id}`;
  const cat  = n.category ? `\n      <category>${xe(n.category)}</category>` : "";
  const tags = (n.tags || []).map((t) => `\n      <category>${xe(t)}</category>`).join("");
  const score = n.scores
    ? Object.entries(n.scores).map(([k, v]) => `${k}=${Number(v).toFixed(1)}`).join(" ")
    : "";
  const desc = [
    n.summary || "",
    "",
    score ? `[4기준 점수] ${score}` : "",
    n.source ? `출처: ${n.source}${n.sourceCountry ? ` (${n.sourceCountry})` : ""}` : "",
  ].filter(Boolean).join("\n");

  return `    <item>
      <title>${xe(n.title || "")}</title>
      <link>${xe(n.url || SITE.url)}</link>
      <description>${xe(desc)}</description>
      <pubDate>${rfc822(n.publishedAt)}</pubDate>
      <guid isPermaLink="false">${xe(guid)}</guid>${cat}${tags}
    </item>`;
}

function insightItem(ins, expertsById) {
  const expert = expertsById[ins.expertId];
  const guid = `${SITE.url}#${ins.id}`;
  const role = expert ? `${expert.role} · ${expert.name}` : ins.expertId;
  const desc = [
    ins.excerpt || "",
    "",
    `핵심 질문: ${ins.keyQuestion || ""}`,
    "",
    `(분야 전문가: ${role})`,
  ].filter(Boolean).join("\n");

  return `    <item>
      <title>[인사이트] ${xe(ins.title || "")}</title>
      <link>${xe(SITE.url + "#" + ins.id)}</link>
      <description>${xe(desc)}</description>
      <pubDate>${rfc822(new Date().toISOString())}</pubDate>
      <guid isPermaLink="false">${xe(guid)}</guid>
      <category>insight</category>
      <category>${xe(ins.tag || "")}</category>
    </item>`;
}

// ── 4. experts.js 평가 (선택, insight 매핑용) ──────────
function loadExpertsById() {
  const file = path.join(ROOT, "data", "experts.js");
  if (!fs.existsSync(file)) return {};
  try {
    const arr = loadBrowserGlobal(file, "__EXPERTS__") || [];
    return Object.fromEntries(arr.map((e) => [e.id, e]));
  } catch { return {}; }
}

// ── 5. 빌드 ────────────────────────────────────────────
function build() {
  const t0 = performance.now();
  const D = loadDaily();
  const expertsById = loadExpertsById();

  const news     = (D.news || []).slice().sort(byDateDesc);
  const insights = (D.insights || []).slice();

  const items = [
    ...news.map(newsItem),
    ...insights.map((i) => insightItem(i, expertsById)),
  ].join("\n");

  const lastBuildIso = (news[0] && news[0].publishedAt) || new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xe(SITE.title)}</title>
    <link>${xe(SITE.url)}</link>
    <atom:link href="${xe(SITE.url + "feed.xml")}" rel="self" type="application/rss+xml" />
    <description>${xe(SITE.description)}</description>
    <language>${xe(SITE.language)}</language>
    <copyright>${xe(SITE.copyright)}</copyright>
    <generator>${xe(SITE.generator)}</generator>
    <lastBuildDate>${rfc822(lastBuildIso)}</lastBuildDate>
    <pubDate>${rfc822(lastBuildIso)}</pubDate>
${items}
  </channel>
</rss>
`;

  fs.writeFileSync(DEST, xml, "utf8");
  const dt = (performance.now() - t0).toFixed(1);
  const sizeKb = (Buffer.byteLength(xml, "utf8") / 1024).toFixed(1);
  console.log(`[generate-feed] wrote ${path.relative(ROOT, DEST)} · ${news.length} news + ${insights.length} insights · ${sizeKb}KB · ${dt}ms`);
}

function byDateDesc(a, b) {
  return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
}

// 직접 실행 시
if (require.main === module) {
  try { build(); }
  catch (err) {
    console.error("[generate-feed] FAILED:", err.message);
    process.exit(1);
  }
}

module.exports = { build, loadDaily, newsItem };
