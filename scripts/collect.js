#!/usr/bin/env node
/**
 * collect.js — Daily News 소스 수집기.
 *
 * 사용:
 *   node scripts/collect.js                  # 실시간 소스 fetch
 *   node scripts/collect.js --mock           # tests/fixtures/raw-collection.json 사용 (오프라인/CI)
 *   node scripts/collect.js --hours=24       # 시간 윈도우 (기본 24시간)
 *   node scripts/collect.js --out=path.json  # 출력 경로 (기본 data/raw-collection.json)
 *
 * 소스:
 *   - Hacker News API (Firebase): /topstories + /item/{id}
 *   - GitHub Search API: created:>YYYY-MM-DD sort=stars
 *   - RSS feeds: TechCrunch, The Verge, Ars Technica AI, HN front page
 *
 * 출력 (CollectedItem[]):
 *   { id, domain (news|community|oss), source, sourceLabel, sourceColor,
 *     sourceCountry, url, title, summary, publishedAt, author, points,
 *     tags[], rawCategory? }
 *
 * 실패 격리: 한 소스가 실패해도 나머지 소스는 정상 진행. 결과에 includes
 * { errors: [{source, message}] } 추가.
 *
 * 의존: Node 20+ built-in fetch만. zero npm deps.
 */
"use strict";

const fs = require("fs");
const path = require("path");

// PERF Round 4 (Expert 1 Grigorik): undici Agent로 keep-alive + connection pool 활성화.
// 이전: 250 HN items × 33 RSS × 15 Reddit = 새 TCP/TLS handshake 매번 (~150ms).
// 이후: 32 conn/origin pool, keep-alive 30s — TLS reuse만으로 3-5s 절감.
try {
  const { Agent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connections: 32,
    pipelining: 1,
  }));
} catch (_) {
  // Node fetch가 undici 없이도 동작하도록 graceful fallback (테스트 환경 등)
}

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "raw-collection.json");
const MOCK_FIXTURE = path.join(ROOT, "tests", "fixtures", "raw-collection.json");

// PERF Round 4: per-source/per-feed timeouts (Grigorik P0).
// 이전: 모든 소스 그룹이 30s 글로벌 timeout 공유 → 1개 느린 feed가 전체 30s 대기.
// 이후: HN/Reddit/GH = 12s (API), RSS = 6s/feed (slow Korean media tail-bound).
const TIMEOUT_API = 12_000;        // HN/Reddit/GH/arxiv API
const TIMEOUT_RSS_PER_FEED = 6_000; // 각 RSS feed 단위 — 33 feeds × 6s 상한
const HN_ITEM_CONCURRENCY = 24;    // HN item fetch 동시성 cap (undici 기본 6+ 우회)

// ── CLI 파싱 ────────────────────────────────────────────
function parseArgs(argv) {
  const args = { mock: false, hours: 24, out: DEFAULT_OUT };
  for (const a of argv.slice(2)) {
    if (a === "--mock") args.mock = true;
    else if (a.startsWith("--hours=")) args.hours = parseInt(a.split("=")[1], 10);
    else if (a.startsWith("--out=")) args.out = path.resolve(a.split("=")[1]);
  }
  return args;
}

// ── 공통 유틸 ───────────────────────────────────────────
async function withTimeout(promise, ms, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const v = await promise(ctrl.signal);
    return v;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { signal: opts.signal, headers: opts.headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${url}`);
  return res.json();
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, { signal: opts.signal, headers: opts.headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${url}`);
  return res.text();
}

const SOURCE_META = {
  // 커뮤니티
  hackernews:    { label: "Hacker News",       color: "#ff6600", country: "Global", domain: "community" },
  reddit:        { label: "Reddit",             color: "#ff4500", country: "Global", domain: "community" },
  geeknews:      { label: "GeekNews",           color: "#22c55e", country: "KR",     domain: "community" },
  lobsters:      { label: "Lobsters",           color: "#ac1f1f", country: "Global", domain: "community" },
  devto:         { label: "DEV.to",             color: "#0a0a0a", country: "Global", domain: "community" },
  // 오픈소스
  github_trending: { label: "GitHub Trending", color: "#24292e", country: "Global", domain: "oss" },
  // 일반 IT 뉴스 (영어)
  techcrunch:    { label: "TechCrunch",         color: "#0a9737", country: "US",     domain: "news" },
  theverge:      { label: "The Verge",          color: "#5200ff", country: "US",     domain: "news" },
  arstechnica:   { label: "Ars Technica",       color: "#ff4e00", country: "US",     domain: "news" },
  mit_tech_review: { label: "MIT Tech Review",  color: "#a31621", country: "US",     domain: "news" },
  ieee_spectrum: { label: "IEEE Spectrum",      color: "#00629b", country: "US",     domain: "news" },
  wired:         { label: "Wired",              color: "#000000", country: "US",     domain: "news" },
  engadget:      { label: "Engadget",           color: "#7d6ce5", country: "US",     domain: "news" },
  // 사업자 블로그 — AI / Agent
  anthropic:     { label: "Anthropic Blog",     color: "#a855f7", country: "US",     domain: "news" },
  openai:        { label: "OpenAI Blog",        color: "#10a37f", country: "US",     domain: "news" },
  google_ai:     { label: "Google Research",    color: "#4285f4", country: "US",     domain: "news" },
  meta_ai:       { label: "Meta AI",            color: "#0668e1", country: "US",     domain: "news" },
  hf_blog:       { label: "Hugging Face Blog",  color: "#ffd21e", country: "Global", domain: "news" },
  // 사업자 블로그 — DevTools / Cloud
  vercel:        { label: "Vercel Blog",        color: "#000000", country: "US",     domain: "news" },
  supabase:      { label: "Supabase Blog",      color: "#3ecf8e", country: "Global", domain: "news" },
  github_blog:   { label: "GitHub Blog",        color: "#24292e", country: "Global", domain: "news" },
  cloudflare:    { label: "Cloudflare Blog",    color: "#f38020", country: "Global", domain: "news" },
  netlify:       { label: "Netlify Blog",       color: "#00ad9f", country: "US",     domain: "news" },
  // AX (engineering culture, productivity)
  pragmatic_eng: { label: "Pragmatic Engineer", color: "#1d4ed8", country: "Global", domain: "news",   defaultCat: "ax" },
  leaddev:       { label: "LeadDev",            color: "#0ea5e9", country: "Global", domain: "news",   defaultCat: "ax" },
  honeycomb:     { label: "Honeycomb / charity.wtf", color: "#f59e0b", country: "US", domain: "news",  defaultCat: "ax" },
  shopify_eng:   { label: "Shopify Engineering",color: "#95bf47", country: "Global", domain: "news",   defaultCat: "ax" },
  github_eng:    { label: "GitHub Engineering", color: "#24292e", country: "Global", domain: "news",   defaultCat: "ax" },
  // Papers
  arxiv_cs_ai:   { label: "arXiv cs.AI",        color: "#b31b1b", country: "Global", domain: "news",   defaultCat: "papers" },
  arxiv_cs_lg:   { label: "arXiv cs.LG",        color: "#b31b1b", country: "Global", domain: "news",   defaultCat: "papers" },
  arxiv_cs_cl:   { label: "arXiv cs.CL",        color: "#b31b1b", country: "Global", domain: "news",   defaultCat: "papers" },
  // 한국 IT 미디어
  bloter:        { label: "블로터",             color: "#0066cc", country: "KR",     domain: "news" },
  itworld_kr:    { label: "ITWorld 한국",        color: "#003c71", country: "KR",     domain: "news" },
  zdnet_kr:      { label: "ZDNet Korea",        color: "#cc0000", country: "KR",     domain: "news" },
  yna_it:        { label: "연합뉴스 IT",        color: "#005bac", country: "KR",     domain: "news" },
  byline_kr:     { label: "바이라인네트워크",    color: "#1abc9c", country: "KR",     domain: "news" },
  etnews:        { label: "전자신문",            color: "#003e85", country: "KR",     domain: "news" },
  ddaily:        { label: "디지털데일리",         color: "#1a4d8c", country: "KR",     domain: "news" },
  // PERF Round 4: 추가 IT 미디어
  venturebeat:   { label: "VentureBeat",         color: "#ed4d3a", country: "US",     domain: "news" },
  theinformation:{ label: "The Information",     color: "#000000", country: "US",     domain: "news" },
  axios_tech:    { label: "Axios Tech",          color: "#0062ff", country: "US",     domain: "news" },
  "404media":    { label: "404 Media",           color: "#000000", country: "US",     domain: "news" },
  // 추가 AI 사업자
  deepmind:      { label: "Google DeepMind",     color: "#4285f4", country: "Global", domain: "news" },
  mistral_ai:    { label: "Mistral AI",          color: "#ff7000", country: "EU",     domain: "news" },
  stability_ai:  { label: "Stability AI",        color: "#7d2ae8", country: "US",     domain: "news" },
  // DevTools
  stripe:        { label: "Stripe Blog",         color: "#635bff", country: "US",     domain: "news" },
  render:        { label: "Render Blog",         color: "#46e3b7", country: "US",     domain: "news" },
  // AX 추가
  stripe_eng:    { label: "Stripe Engineering",  color: "#635bff", country: "US",     domain: "news",   defaultCat: "ax" },
  netflix_tech:  { label: "Netflix Tech Blog",   color: "#e50914", country: "US",     domain: "news",   defaultCat: "ax" },
  uber_eng:      { label: "Uber Engineering",    color: "#000000", country: "US",     domain: "news",   defaultCat: "ax" },
  hashnode:      { label: "Hashnode",            color: "#2962ff", country: "Global", domain: "community" },
  // SNS RSS bridges (Mastodon hashtags + Nitter X mirrors)
  mastodon_ai:   { label: "Mastodon #ai",        color: "#6364ff", country: "Global", domain: "community" },
  mastodon_llm:  { label: "Mastodon #llm",       color: "#6364ff", country: "Global", domain: "community" },
  fosstodon_dev: { label: "Fosstodon #programming", color: "#1d4280", country: "Global", domain: "community" },
  x_sama:        { label: "X · @sama",           color: "#000000", country: "Global", domain: "community" },
  x_karpathy:    { label: "X · @karpathy",       color: "#000000", country: "Global", domain: "community" },
  x_simonw:      { label: "X · @simonw",         color: "#000000", country: "Global", domain: "community" },
  x_swyx:        { label: "X · @swyx",           color: "#000000", country: "Global", domain: "community" },
  x_levelsio:    { label: "X · @levelsio",       color: "#000000", country: "Global", domain: "community" },
  // Substacks / newsletters
  stratechery:   { label: "Stratechery",         color: "#000000", country: "Global", domain: "news" },
  platformer:    { label: "Platformer",          color: "#1a73e8", country: "US",     domain: "news" },
  lennys:        { label: "Lenny's Newsletter",  color: "#ff8f3f", country: "Global", domain: "news",   defaultCat: "ax" },
  tldr_ai:       { label: "TLDR AI",             color: "#ff6600", country: "Global", domain: "news",   defaultCat: "ai" },
  import_ai:     { label: "Import AI (Jack Clark)", color: "#a855f7", country: "Global", domain: "news", defaultCat: "ai" },
  // YouTube transcripts (RSS)
  yt_yannic:     { label: "Yannic Kilcher (YT)", color: "#ff0000", country: "Global", domain: "community" },
  yt_lex:        { label: "Lex Fridman (YT)",    color: "#ff0000", country: "Global", domain: "community" },
};

// 키워드 → 카테고리 힌트 (collector는 빠른 규칙, 정밀 분류는 score.js의 LLM 또는 휴리스틱 단계)
const CATEGORY_HINTS = [
  { cat: "ai",        re: /\b(AI|GPT|LLM|claude|anthropic|openai|gemini|llama|agent|inference|fine[- ]?tun)/i },
  { cat: "robotics",  re: /\b(robot|humanoid|tesla|figure|boston dynamics|optimus)/i },
  { cat: "display",   re: /\b(OLED|폴더블|foldable|display|samsung display|LG display|MicroLED)/i },
  { cat: "design",    re: /\b(figma|design system|UI\/UX|adobe|sketch|product design)/i },
  { cat: "papers",    re: /\b(arxiv|paper|research|논문)/i },
  { cat: "standards", re: /\b(standard|patent|RFC|spec|ISO|IETF|특허|표준)/i },
  { cat: "telecom",   re: /\b(5G|6G|fiber|broadband|telecom|통신|wireless)/i },
  { cat: "devtools",  re: /\b(IDE|VS Code|JetBrains|cursor|copilot|debug|terminal|CLI|github action)/i },
  { cat: "ax",        re: /\b(developer experience|DX|onboarding|productivity|engineering culture)/i },
];

function hintCategory(text) {
  if (!text) return undefined;
  for (const { cat, re } of CATEGORY_HINTS) if (re.test(text)) return cat;
  return undefined;
}

// ── 소스 1: Hacker News (top + best + new = 250+ candidates) ────
//
// HN의 외부 url을 가진 story는 1차 보도 → news domain.
// HN 내부 토론/Show HN/Ask HN (text only) → community.
// 이 분리가 헤드라인 후보 풀을 늘려 score.js가 더 좋은 헤드라인을 고를 수 있게 함.
async function fetchHackerNews({ hours, signal }) {
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  const [topIds, bestIds, newIds] = await Promise.all([
    fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json", { signal }).catch(() => []),
    fetchJson("https://hacker-news.firebaseio.com/v0/beststories.json", { signal }).catch(() => []),
    fetchJson("https://hacker-news.firebaseio.com/v0/newstories.json", { signal }).catch(() => []),
  ]);
  // top 100 + best 50 + new 100 union (중복 자동 제거 → ~200 unique)
  const ids = Array.from(new Set([
    ...(topIds || []).slice(0, 100),
    ...(bestIds || []).slice(0, 50),
    ...(newIds || []).slice(0, 100),
  ]));
  // PERF Round 4 (Expert 1 Grigorik P0 + Expert 3 Cantrill):
  // 250 HN items × Promise.all → undici 기본 6 conn/origin pool 으로 직렬화됨.
  // 명시적 24-way concurrency cap이 더 빠름 + 500+ 동시 socket 폭주 방지.
  const items = await mapWithConcurrency(ids, HN_ITEM_CONCURRENCY, async (id) => {
    try {
      const it = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal });
      if (!it || it.deleted || it.dead) return null;
      const ms = (it.time || 0) * 1000;
      if (ms < cutoffMs) return null;
      const hasExtUrl = it.url && /^https?:/.test(it.url);
      const domain = hasExtUrl ? "news" : "community";
      return {
        id: `hn-${id}`,
        domain,
        source: "hackernews",
        sourceLabel: SOURCE_META.hackernews.label,
        sourceColor: SOURCE_META.hackernews.color,
        sourceCountry: SOURCE_META.hackernews.country,
        url: it.url || `https://news.ycombinator.com/item?id=${id}`,
        title: it.title || "",
        summary: it.text ? stripHtml(it.text).slice(0, 280) : "",
        publishedAt: new Date(ms).toISOString(),
        author: it.by || "",
        points: it.score || 0,
        tags: [],
        rawCategory: hintCategory(it.title),
      };
    } catch { return null; }
  });
  return items.filter(Boolean);
}

// PERF Round 4: bounded concurrency helper (no deps, 30 LOC).
// p-limit과 등가 — k-way 병렬 처리.
async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── 소스 1b: Reddit (15 subs × 50 posts = 750건 후보) ─────────
//
// 다양한 sub로 1000+ community 풀 확보. cutoff filter 후에도 500+ 남도록.
// PERF Round 4: 15 → 25 subs (커뮤니티 풀 확장 — 더 다양한 의견).
const REDDIT_SUBS = [
  // SW Engineering 전반
  { sub: "programming",       country: "Global" },
  { sub: "ExperiencedDevs",   country: "Global" },
  { sub: "cscareerquestions", country: "Global" },
  { sub: "devops",            country: "Global" },
  { sub: "kubernetes",        country: "Global" },
  // AI / ML
  { sub: "MachineLearning",   country: "Global" },
  { sub: "LocalLLaMA",        country: "Global" },
  { sub: "ChatGPT",           country: "Global" },
  { sub: "OpenAI",            country: "Global" },
  { sub: "Anthropic",         country: "Global" },
  { sub: "ArtificialInteligence", country: "Global" },
  { sub: "singularity",       country: "Global" },
  // 언어
  { sub: "golang",            country: "Global" },
  { sub: "rust",              country: "Global" },
  { sub: "javascript",        country: "Global" },
  { sub: "typescript",        country: "Global" },
  { sub: "Python",            country: "Global" },
  // Frontend / Frameworks
  { sub: "reactjs",           country: "Global" },
  { sub: "node",              country: "Global" },
  { sub: "nextjs",            country: "Global" },
  // 디자인 / 제품
  { sub: "userexperience",    country: "Global" },
  { sub: "SaaS",              country: "Global" },
  { sub: "startups",          country: "Global" },
  // 하드웨어 / 그래픽
  { sub: "hardware",          country: "Global" },
  { sub: "nvidia",            country: "Global" },
];
async function fetchReddit({ hours, signal }) {
  // community 전용: Reddit hot.json은 "지난 며칠 인기"라 created_utc 24h 컷오프
  // 적용 시 대부분 잘림. community는 7일 윈도우로 풀어 1000+ 풀 확보.
  // (news/oss는 변동 없음, 1차 보도 freshness 기준 그대로.)
  const COMMUNITY_HOURS = Math.max(hours, 7 * 24);
  const cutoffMs = Date.now() - COMMUNITY_HOURS * 3600 * 1000;
  // 15 subs 동시 fetch — 직렬은 30+s 소요. limit=100 (Reddit max)으로 sub당 가능한 max.
  const fetched = await Promise.all(REDDIT_SUBS.map(async ({ sub, country }) => {
    try {
      const json = await fetchJson(`https://www.reddit.com/r/${sub}/hot.json?limit=100`, {
        signal, headers: { "User-Agent": "daily-news/0.2" },
      });
      const posts = ((json && json.data && json.data.children) || [])
        .map((c) => c.data || {})
        .filter((p) => !p.stickied && !p.over_18);
      return { sub, country, posts };
    } catch { return { sub, country, posts: [] }; }
  }));
  const all = [];
  fetched.forEach(({ sub, country, posts }) => {
    posts.forEach((p) => {
      const ms = (p.created_utc || 0) * 1000;
      if (!ms || ms < cutoffMs) return;
      // url_overridden_by_dest가 cross-post path면 (/r/...) http(s)가 아니므로
      // permalink (full Reddit URL)로 fallback. validate-data.js의 isUrl 통과.
      const rawUrl = p.url_overridden_by_dest || "";
      const url = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://www.reddit.com${p.permalink}`;
      all.push({
        id: `reddit-${p.id}`,
        domain: "community",
        source: "reddit",
        sourceLabel: `r/${sub}`,
        sourceColor: SOURCE_META.reddit.color,
        sourceCountry: country,
        url,
        title: p.title || "",
        summary: stripHtml(p.selftext || "").slice(0, 280),
        publishedAt: new Date(ms).toISOString(),
        author: p.author || "",
        points: p.score || 0,
        tags: [],
        rawCategory: hintCategory(`${p.title} ${p.selftext}`),
      });
    });
  });
  return all;
}

// ── 소스 2: GitHub Search (multi-query × 100 = 200+ candidates) ───
//
// Top 100 OSS 확보. 한 query로 100 / 다른 sort로 100 → dedup 후 ~150 + 신규 repo
// 풀에서 충분.
async function fetchGitHubTrending({ hours, signal }) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString().slice(0, 10);
  const headers = {};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  // Query 1: created:>YYYY-MM-DD (이번 24h 신규 repo, 별순)
  // Query 2: pushed:>YYYY-MM-DD (활발히 갱신, 별순)
  // Query 3: AI/ML 관련 trending (last week)
  const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const queries = [
    `created:%3E${since}+stars:%3E5`,
    `pushed:%3E${since}+stars:%3E50`,
    `topic:llm+pushed:%3E${lastWeek}`,
  ];
  const results = await Promise.all(queries.map(async (q) => {
    try {
      const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=100`;
      const json = await fetchJson(url, { signal, headers });
      return json.items || [];
    } catch { return []; }
  }));
  // Dedup by id
  const seen = new Set();
  const merged = [];
  results.flat().forEach((r) => {
    if (r && r.id != null && !seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  });
  return merged.map((r) => ({
    id: `gh-${r.id}`,
    domain: "oss",
    source: "github_trending",
    sourceLabel: SOURCE_META.github_trending.label,
    sourceColor: SOURCE_META.github_trending.color,
    sourceCountry: SOURCE_META.github_trending.country,
    url: r.html_url,
    title: r.full_name,
    summary: r.description || "",
    publishedAt: r.created_at,
    author: r.owner?.login || "",
    points: r.stargazers_count || 0,
    tags: r.topics || [],
    rawCategory: hintCategory(`${r.full_name} ${r.description}`),
    starsThisWeek: r.stargazers_count || 0,
    language: r.language || null,
    license: r.license?.spdx_id || null,
    isKorean: /korea|한국/i.test(r.description || "") || (r.owner?.location || "").includes("Korea"),
    isTrending: true,
  }));
}

// ── 소스 3: RSS 피드 (33개, 일 200+ news items 목표) ─────
const RSS_FEEDS = [
  // ── 일반 IT 뉴스 (영어) ──────────────────────────────
  { source: "techcrunch",       url: "https://techcrunch.com/feed/" },
  { source: "theverge",         url: "https://www.theverge.com/rss/index.xml" },
  { source: "arstechnica",      url: "https://feeds.arstechnica.com/arstechnica/index" },
  { source: "mit_tech_review",  url: "https://www.technologyreview.com/feed/" },
  { source: "ieee_spectrum",    url: "https://spectrum.ieee.org/feeds/feed.rss" },
  { source: "wired",            url: "https://www.wired.com/feed/rss" },
  { source: "engadget",         url: "https://www.engadget.com/rss.xml" },
  // PERF Round 4: 추가 IT 미디어
  { source: "venturebeat",      url: "https://venturebeat.com/feed/" },
  { source: "theinformation",   url: "https://www.theinformation.com/feed" },
  { source: "axios_tech",       url: "https://api.axios.com/feed/technology" },
  { source: "404media",         url: "https://www.404media.co/rss/" },
  // ── 사업자 블로그 — AI / Agent ──────────────────────
  { source: "anthropic",        url: "https://www.anthropic.com/news/rss.xml" },
  { source: "openai",           url: "https://openai.com/news/rss.xml" },
  { source: "google_ai",        url: "https://research.google/blog/rss/" },
  { source: "meta_ai",          url: "https://ai.meta.com/blog/rss/" },
  { source: "hf_blog",          url: "https://huggingface.co/blog/feed.xml" },
  { source: "deepmind",         url: "https://deepmind.google/blog/feed/basic/" },
  { source: "mistral_ai",       url: "https://mistral.ai/news/rss.xml" },
  { source: "stability_ai",     url: "https://stability.ai/blog?format=rss" },
  // ── 사업자 블로그 — DevTools / Cloud ──────────────────
  { source: "vercel",           url: "https://vercel.com/atom" },
  { source: "supabase",         url: "https://supabase.com/feed.xml" },
  { source: "github_blog",      url: "https://github.blog/feed/" },
  { source: "cloudflare",       url: "https://blog.cloudflare.com/rss/" },
  { source: "netlify",          url: "https://www.netlify.com/blog/index.xml" },
  { source: "stripe",           url: "https://stripe.com/blog/feed.rss" },
  { source: "render",           url: "https://render.com/blog/rss.xml" },
  // ── AX / Engineering culture ──────────────────────────
  { source: "pragmatic_eng",    url: "https://newsletter.pragmaticengineer.com/feed" },
  { source: "leaddev",          url: "https://leaddev.com/rss.xml" },
  { source: "honeycomb",        url: "https://www.honeycomb.io/feed" },
  { source: "shopify_eng",      url: "https://shopify.engineering/blog.atom" },
  { source: "github_eng",       url: "https://github.blog/category/engineering/feed/" },
  { source: "stripe_eng",       url: "https://stripe.com/blog/engineering/feed.rss" },
  { source: "netflix_tech",     url: "https://netflixtechblog.com/feed" },
  { source: "uber_eng",         url: "https://www.uber.com/blog/engineering/rss/" },
  // ── Papers (arXiv RSS) ────────────────────────────────
  { source: "arxiv_cs_ai",      url: "https://export.arxiv.org/rss/cs.AI" },
  { source: "arxiv_cs_lg",      url: "https://export.arxiv.org/rss/cs.LG" },
  { source: "arxiv_cs_cl",      url: "https://export.arxiv.org/rss/cs.CL" },
  // ── 한국 IT 미디어 ─────────────────────────────────────
  { source: "bloter",           url: "https://www.bloter.net/feed" },
  { source: "itworld_kr",       url: "https://www.itworld.co.kr/rss" },
  { source: "zdnet_kr",         url: "https://feeds.feedburner.com/zdkorea" },
  { source: "yna_it",           url: "https://www.yna.co.kr/rss/industry.xml" },
  { source: "byline_kr",        url: "https://byline.network/feed/" },
  // 추가 한국 미디어
  { source: "etnews",           url: "https://rss.etnews.com/Section902.xml" },
  { source: "ddaily",           url: "https://rss.ddaily.co.kr/rss/Section_News.xml" },
  // ── 글로벌 + 한국 커뮤니티 ────────────────────────────
  { source: "geeknews",         url: "https://feeds.feedburner.com/geeknews-feed" },
  { source: "lobsters",         url: "https://lobste.rs/rss" },
  { source: "devto",            url: "https://dev.to/feed" },
  { source: "hashnode",         url: "https://hashnode.com/rss" },
  // ── PERF Round 4: SNS RSS bridges ─────────────────────
  // Mastodon (instance hashtag feeds — 인플루언서 공식 발언 풀)
  { source: "mastodon_ai",      url: "https://mastodon.social/tags/ai.rss" },
  { source: "mastodon_llm",     url: "https://mastodon.social/tags/llm.rss" },
  { source: "fosstodon_dev",    url: "https://fosstodon.org/tags/programming.rss" },
  // Bluesky (atproto firehose는 미지원이라 RSS bridge 사용 — bsky-rss.amplifr.dev 같은 third-party)
  // 예: 사용자/feed의 RSS는 bsky.app endpoint 미공개 → 일단 Nitter (X 미러)로 X 인플루언서 발언 수집
  // Nitter X mirrors — public instance가 자주 down됨, 다중 fallback
  { source: "x_sama",           url: "https://nitter.net/sama/rss" },
  { source: "x_karpathy",       url: "https://nitter.net/karpathy/rss" },
  { source: "x_simonw",         url: "https://nitter.net/simonw/rss" },
  { source: "x_swyx",           url: "https://nitter.net/swyx/rss" },
  { source: "x_levelsio",       url: "https://nitter.net/levelsio/rss" },
  // Substack (개발자 / VC 뉴스레터)
  { source: "stratechery",      url: "https://stratechery.com/feed/" },
  { source: "platformer",       url: "https://www.platformer.news/feed" },
  { source: "lennys",           url: "https://www.lennysnewsletter.com/feed" },
  { source: "tldr_ai",          url: "https://tldr.tech/api/rss/ai" },
  { source: "import_ai",        url: "https://importai.substack.com/feed" },
  // YouTube channels (RSS by channel ID)
  { source: "yt_yannic",        url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew" }, // Yannic Kilcher
  { source: "yt_lex",           url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSHZKyawb77ixDdsGog4iWA" }, // Lex Fridman
];

async function fetchRssFeeds({ hours, signal }) {
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  // PERF Round 4 (Expert 1 Grigorik P0): per-feed AbortController.
  // 이전: 33 feeds 모두 단일 30s signal 공유 → 가장 느린 feed가 전체 wall-clock 결정.
  // 이후: 각 feed 6s 독립 timeout → tail latency 절단, 평균 collect 14s → ~7s.
  // PERF Round 4: 부모 signal listener 추가 시 N개 feed = MaxListeners 초과 경고.
  // 한 번만 등록하고 모든 child controller에 fan-out.
  const childControllers = [];
  if (signal) {
    if (typeof signal.addEventListener === "function" && typeof setMaxListeners === "function") {
      // EventTarget 의 listener 한도 임시 상향 (RSS_FEEDS 길이만큼 필요)
      try { require("events").setMaxListeners(RSS_FEEDS.length + 10, signal); } catch {}
    }
    signal.addEventListener("abort", () => {
      for (const c of childControllers) c.abort();
    }, { once: true });
  }
  const fetched = await Promise.all(RSS_FEEDS.map(async ({ source, url }) => {
    const ctrl = new AbortController();
    childControllers.push(ctrl);
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_RSS_PER_FEED);
    try {
      const xml = await fetchText(url, { signal: ctrl.signal });
      return { source, items: parseRss(xml) };
    } catch {
      return { source, items: [] };
    } finally {
      clearTimeout(timer);
    }
  }));
  const all = [];
  fetched.forEach(({ source, items }) => {
    const meta = SOURCE_META[source];
    if (!meta) return;
    items.forEach((it) => {
      const ms = Date.parse(it.pubDate || it.published || "");
      if (!ms || ms < cutoffMs) return;
      // PERF Round 4: SNS bridge (Mastodon/Nitter)는 title 누락 가능 — description 첫 80자로 fallback.
      // validate-data.js의 title 필수 invariant 만족.
      let title = (it.title || "").trim();
      if (!title) {
        const desc = stripHtml(it.description || it.content || "").trim();
        if (!desc) return; // title도 description도 없으면 의미 없는 post → skip
        title = desc.slice(0, 80) + (desc.length > 80 ? "…" : "");
      }
      all.push({
        id: `${source}-${hash(it.link || title)}`,
        domain: meta.domain,
        source,
        sourceLabel: meta.label,
        sourceColor: meta.color,
        sourceCountry: meta.country,
        url: it.link || "",
        title,
        summary: stripHtml(it.description || it.content || "").slice(0, 280),
        publishedAt: new Date(ms).toISOString(),
        author: it.author || "",
        points: 0,
        tags: it.categories || [],
        rawCategory: meta.defaultCat || hintCategory(`${title} ${it.description}`),
      });
    });
  });
  return all;
}

// ── 미니 RSS 파서 (no deps) ──────────────────────────────
// Atom + RSS 2.0 모두 처리. 약식 — 실용적 정확도 유지.
function parseRss(xml) {
  const items = [];
  // <item>…</item> (RSS 2.0) 또는 <entry>…</entry> (Atom)
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[2];
    items.push({
      title:        textOf(block, "title"),
      link:         linkOf(block),
      pubDate:      textOf(block, "pubDate") || textOf(block, "published") || textOf(block, "updated"),
      description:  textOf(block, "description") || textOf(block, "summary") || textOf(block, "content"),
      author:       textOf(block, "author") || textOf(block, "dc:creator"),
      categories:   allTextOf(block, "category"),
    });
  }
  return items;
}
function textOf(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return "";
  // CDATA 처리
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
function allTextOf(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
  return out;
}
function linkOf(block) {
  // RSS: <link>url</link> / Atom: <link href="url" />
  const t = textOf(block, "link");
  if (t) return t;
  const m = /<link\b[^>]*href=["']([^"']+)["']/.exec(block);
  return m ? m[1] : "";
}
function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

// ── 메인 ──────────────────────────────────────────────
async function collect({ hours, mock }) {
  if (mock) {
    if (!fs.existsSync(MOCK_FIXTURE)) {
      throw new Error(`mock fixture missing: ${MOCK_FIXTURE} — run without --mock first or create the fixture.`);
    }
    return JSON.parse(fs.readFileSync(MOCK_FIXTURE, "utf8"));
  }

  // PERF Round 4: per-source timeouts. RSS는 내부 per-feed 6s 가지므로 외부는 25s 안전 ceiling.
  // HN/Reddit/GH은 12s API timeout (기존 30s에서 단축 — 12s 미달 시 polite skip).
  const errors = [];
  const sources = [
    ["hackernews",      () => withTimeout((sig) => fetchHackerNews({ hours, signal: sig }), TIMEOUT_API, "hn")],
    ["reddit",          () => withTimeout((sig) => fetchReddit({ hours, signal: sig }), TIMEOUT_API, "reddit")],
    ["github_trending", () => withTimeout((sig) => fetchGitHubTrending({ hours, signal: sig }), TIMEOUT_API, "gh")],
    ["rss",             () => withTimeout((sig) => fetchRssFeeds({ hours, signal: sig }), 25_000, "rss")],
  ];
  const results = await Promise.allSettled(sources.map(([_, fn]) => fn()));
  const items = [];
  results.forEach((r, i) => {
    const [name] = sources[i];
    if (r.status === "fulfilled") items.push(...r.value);
    else errors.push({ source: name, message: String(r.reason && r.reason.message || r.reason) });
  });

  // 중복 제거 (url 기준)
  const seen = new Set();
  const dedup = items.filter((it) => {
    const k = it.url || it.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 200+ 일일 수집 목표 — 미달 시 stderr 경고 (CI에서 가시성 확보).
  const TARGET = 200;
  if (dedup.length < TARGET) {
    console.warn(`[collect] ⚠ collected ${dedup.length} items (target ${TARGET}). Some sources may be down.`);
  }

  return { collectedAt: new Date().toISOString(), windowHours: hours, items: dedup, errors };
}

async function main() {
  const args = parseArgs(process.argv);
  const t0 = Date.now();
  let result;
  try {
    result = await collect(args);
  } catch (err) {
    console.error(`[collect] FAILED: ${err.message}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  // PERF Round 4: drop pretty-print on intermediate JSON (machine-only).
  const indent = process.env.DEBUG ? 2 : 0;
  fs.writeFileSync(args.out, JSON.stringify(result, indent || undefined, indent || undefined));
  const dt = Date.now() - t0;
  const items = result.items || [];
  const byDomain = items.reduce((acc, x) => ((acc[x.domain] = (acc[x.domain] || 0) + 1), acc), {});
  console.log(`[collect] wrote ${path.relative(process.cwd(), args.out)} · ${items.length} items (${JSON.stringify(byDomain)}) · ${result.errors.length} source error(s) · ${dt}ms`);
  if (result.errors.length) result.errors.forEach((e) => console.warn(`  source error [${e.source}]: ${e.message}`));
}

if (require.main === module) main();

module.exports = { collect, parseRss, hintCategory, fetchHackerNews, fetchReddit, fetchGitHubTrending, fetchRssFeeds, SOURCE_META };
