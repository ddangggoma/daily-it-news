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

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "raw-collection.json");
const MOCK_FIXTURE = path.join(ROOT, "tests", "fixtures", "raw-collection.json");

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
  const items = await Promise.all(ids.map(async (id) => {
    try {
      const it = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal });
      if (!it || it.deleted || it.dead) return null;
      const ms = (it.time || 0) * 1000;
      if (ms < cutoffMs) return null;
      // HN 분류 규칙: 외부 url 있으면 news (1차 보도 후보), 없으면 community.
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
        // news domain일 때 build-today.js가 sourceCountry를 표시하므로 명시
        // (HN 자체는 Global이지만 origin URL의 도메인을 미래에 inspect 가능)
      };
    } catch { return null; }
  }));
  return items.filter(Boolean);
}

// ── 소스 1b: Reddit (15 subs × 50 posts = 750건 후보) ─────────
//
// 다양한 sub로 1000+ community 풀 확보. cutoff filter 후에도 500+ 남도록.
const REDDIT_SUBS = [
  { sub: "programming",       country: "Global" },
  { sub: "MachineLearning",   country: "Global" },
  { sub: "LocalLLaMA",        country: "Global" },
  { sub: "devops",            country: "Global" },
  { sub: "golang",            country: "Global" },
  { sub: "rust",              country: "Global" },
  { sub: "javascript",        country: "Global" },
  { sub: "typescript",        country: "Global" },
  { sub: "reactjs",           country: "Global" },
  { sub: "node",              country: "Global" },
  { sub: "ChatGPT",           country: "Global" },
  { sub: "OpenAI",            country: "Global" },
  { sub: "ArtificialInteligence", country: "Global" },
  { sub: "cscareerquestions", country: "Global" },
  { sub: "ExperiencedDevs",   country: "Global" },
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
  // 일반 IT 뉴스 (영어)
  { source: "techcrunch",       url: "https://techcrunch.com/feed/" },
  { source: "theverge",         url: "https://www.theverge.com/rss/index.xml" },
  { source: "arstechnica",      url: "https://feeds.arstechnica.com/arstechnica/index" },
  { source: "mit_tech_review",  url: "https://www.technologyreview.com/feed/" },
  { source: "ieee_spectrum",    url: "https://spectrum.ieee.org/feeds/feed.rss" },
  { source: "wired",            url: "https://www.wired.com/feed/rss" },
  { source: "engadget",         url: "https://www.engadget.com/rss.xml" },
  // 사업자 블로그 — AI / Agent
  { source: "anthropic",        url: "https://www.anthropic.com/news/rss.xml" },
  { source: "openai",           url: "https://openai.com/news/rss.xml" },
  { source: "google_ai",        url: "https://research.google/blog/rss/" },
  { source: "meta_ai",          url: "https://ai.meta.com/blog/rss/" },
  { source: "hf_blog",          url: "https://huggingface.co/blog/feed.xml" },
  // 사업자 블로그 — DevTools / Cloud
  { source: "vercel",           url: "https://vercel.com/atom" },
  { source: "supabase",         url: "https://supabase.com/feed.xml" },
  { source: "github_blog",      url: "https://github.blog/feed/" },
  { source: "cloudflare",       url: "https://blog.cloudflare.com/rss/" },
  { source: "netlify",          url: "https://www.netlify.com/blog/index.xml" },
  // AX (engineering culture)
  { source: "pragmatic_eng",    url: "https://newsletter.pragmaticengineer.com/feed" },
  { source: "leaddev",          url: "https://leaddev.com/rss.xml" },
  { source: "honeycomb",        url: "https://www.honeycomb.io/feed" },
  { source: "shopify_eng",      url: "https://shopify.engineering/blog.atom" },
  { source: "github_eng",       url: "https://github.blog/category/engineering/feed/" },
  // Papers (arXiv RSS — top categories)
  { source: "arxiv_cs_ai",      url: "https://export.arxiv.org/rss/cs.AI" },
  { source: "arxiv_cs_lg",      url: "https://export.arxiv.org/rss/cs.LG" },
  { source: "arxiv_cs_cl",      url: "https://export.arxiv.org/rss/cs.CL" },
  // 한국 IT 미디어
  { source: "bloter",           url: "https://www.bloter.net/feed" },
  { source: "itworld_kr",       url: "https://www.itworld.co.kr/rss" },
  { source: "zdnet_kr",         url: "https://feeds.feedburner.com/zdkorea" },
  { source: "yna_it",           url: "https://www.yna.co.kr/rss/industry.xml" },
  { source: "byline_kr",        url: "https://byline.network/feed/" },
  // 한국 + 글로벌 커뮤니티
  { source: "geeknews",         url: "https://feeds.feedburner.com/geeknews-feed" },
  { source: "lobsters",         url: "https://lobste.rs/rss" },
  // 개발자 커뮤니티 (community 풀 보강)
  { source: "devto",            url: "https://dev.to/feed" },
];

async function fetchRssFeeds({ hours, signal }) {
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  // 병렬 fetch — 18개 피드 직렬은 너무 느림. 각 피드 자체 실패는 무시.
  const fetched = await Promise.all(RSS_FEEDS.map(async ({ source, url }) => {
    try {
      const xml = await fetchText(url, { signal });
      return { source, items: parseRss(xml) };
    } catch { return { source, items: [] }; }
  }));
  const all = [];
  fetched.forEach(({ source, items }) => {
    const meta = SOURCE_META[source];
    if (!meta) return;
    items.forEach((it) => {
      const ms = Date.parse(it.pubDate || it.published || "");
      if (!ms || ms < cutoffMs) return;
      all.push({
        id: `${source}-${hash(it.link || it.title)}`,
        domain: meta.domain,
        source,
        sourceLabel: meta.label,
        sourceColor: meta.color,
        sourceCountry: meta.country,
        url: it.link || "",
        title: it.title || "",
        summary: stripHtml(it.description || it.content || "").slice(0, 280),
        publishedAt: new Date(ms).toISOString(),
        author: it.author || "",
        points: 0,
        tags: it.categories || [],
        // defaultCat (AX, papers 등)이 있으면 우선; 없으면 키워드 기반 hint
        rawCategory: meta.defaultCat || hintCategory(`${it.title} ${it.description}`),
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

  const TIMEOUT = 30_000;  // RSS 18개 병렬 fetch는 시간 더 필요
  const errors = [];
  const sources = [
    ["hackernews",      () => withTimeout((sig) => fetchHackerNews({ hours, signal: sig }), TIMEOUT, "hn")],
    ["reddit",          () => withTimeout((sig) => fetchReddit({ hours, signal: sig }), TIMEOUT, "reddit")],
    ["github_trending", () => withTimeout((sig) => fetchGitHubTrending({ hours, signal: sig }), TIMEOUT, "gh")],
    ["rss",             () => withTimeout((sig) => fetchRssFeeds({ hours, signal: sig }), TIMEOUT, "rss")],
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
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2));
  const dt = Date.now() - t0;
  const items = result.items || [];
  const byDomain = items.reduce((acc, x) => ((acc[x.domain] = (acc[x.domain] || 0) + 1), acc), {});
  console.log(`[collect] wrote ${path.relative(process.cwd(), args.out)} · ${items.length} items (${JSON.stringify(byDomain)}) · ${result.errors.length} source error(s) · ${dt}ms`);
  if (result.errors.length) result.errors.forEach((e) => console.warn(`  source error [${e.source}]: ${e.message}`));
}

if (require.main === module) main();

module.exports = { collect, parseRss, hintCategory, fetchHackerNews, fetchReddit, fetchGitHubTrending, fetchRssFeeds, SOURCE_META };
