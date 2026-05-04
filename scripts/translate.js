#!/usr/bin/env node
/**
 * translate.js — 🌏 영어 카드뉴스 → 한국어 번역 단계.
 *
 * 사용:
 *   node scripts/translate.js                          # data/scored-items.json → 인플레이스 번역
 *   node scripts/translate.js --in=PATH --out=PATH     # I/O 경로 지정
 *   node scripts/translate.js --no-llm                 # 사전(딕셔너리) 기반 단순 변환만
 *   node scripts/translate.js --batch=10               # LLM 1회 호출당 항목 수 (기본 10)
 *
 * 사용자 요청 ("모든 카드뉴스의 내용은 한글로 번역해줘"):
 *   - news[], community[], oss[], research[]의 title/summary가 영어인 항목을 감지
 *   - title_ko, summary_ko 필드 추가 (원문 보존, 표시 시 한글 우선)
 *   - LLM 호출 결과를 .translation-cache.json에 캐시 (같은 텍스트 재번역 방지)
 *   - 한국어 항목은 그대로 (이중 처리 방지)
 *
 * 캐시 키: SHA-256(text). LLM 비용 최소화 + 일관성 유지.
 *
 * 의존: Node 20+ built-in fetch + crypto (캐시 키), zero npm deps.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_IN = path.join(ROOT, "data", "scored-items.json");
const DEFAULT_OUT = DEFAULT_IN; // 인플레이스 (별도 파일 분리는 복잡도만 증가)
const CACHE_FILE = path.join(ROOT, "data", ".translation-cache.json");

// ── CLI 파싱 ───────────────────────────────────────────
function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, llm: true, batch: 10 };
  for (const a of argv.slice(2)) {
    if (a === "--no-llm") args.llm = false;
    else if (a.startsWith("--in=")) args.in = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--out=")) args.out = path.resolve(a.split("=")[1]);
    else if (a.startsWith("--batch=")) args.batch = parseInt(a.split("=")[1], 10) || 10;
  }
  return args;
}

// ── 한국어/영어 감지 (heuristic) ──────────────────────
// 한글 unicode block (가-힣) 비율로 판단. 30%+ 한글이면 한국어로 간주.
const HANGUL_RE = /[가-힯]/g;
function isKorean(text) {
  if (!text || typeof text !== "string") return true; // 빈 문자열은 번역 불필요
  const trimmed = text.trim();
  if (trimmed.length < 5) return true; // 너무 짧음 → 번역 의미 없음
  const hangul = (trimmed.match(HANGUL_RE) || []).length;
  return (hangul / trimmed.length) > 0.3;
}

// ── 캐시 ────────────────────────────────────────────────
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {}
  return {};
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.warn(`[translate] 캐시 저장 실패: ${e.message}`);
  }
}

function cacheKey(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 24);
}

// ── 사전 기반 fallback 번역 (LLM 미사용 시) ──────────────
// 흔한 IT 용어만 간단 매핑. 완전한 번역은 LLM 필수.
const SIMPLE_DICT = {
  "Show HN:": "[HN]",
  "Ask HN:": "[HN 질문]",
  " released ": " 출시 ",
  " announces ": " 발표 ",
  " announced ": " 발표 ",
  " launches ": " 출시 ",
  " launched ": " 출시 ",
  " open-sources ": " 오픈소스화 ",
  " is now ": " 이제 ",
  " arrives ": " 등장 ",
  " open source ": " 오픈소스 ",
};

function simpleTranslate(text) {
  if (!text) return text;
  let out = text;
  for (const [en, ko] of Object.entries(SIMPLE_DICT)) {
    out = out.split(en).join(ko);
  }
  return out;
}

// ── LLM 일괄 번역 ─────────────────────────────────────
// 한 번에 N개 항목을 묶어 호출 → API 비용 N분의 1.
// XML-style 구분자로 prompt-injection 표면 제한.
async function llmTranslateBatch(texts, signal) {
  if (!process.env.ANTHROPIC_API_KEY) return texts.map(() => null);
  const items = texts.map((t, i) => `<item id="${i}">${t.replace(/[<>]/g, "")}</item>`).join("\n");
  const prompt = `다음 영어 IT 뉴스 제목/요약을 자연스러운 한국어로 번역. 기술 용어(API, GPU, LLM 등)는 영문 유지. 각 item의 번역만 출력. 다른 설명 금지.

<items>
${items}
</items>

JSON 배열로 응답: [{"id":0,"ko":"번역"},{"id":1,"ko":"번역"},...]`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: signal || ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const text = (json.content && json.content[0] && json.content[0].text) || "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return texts.map(() => null);
    const parsed = JSON.parse(m[0]);
    // id로 정렬해서 반환
    const out = texts.map(() => null);
    for (const r of parsed) {
      if (typeof r.id === "number" && r.id >= 0 && r.id < texts.length && typeof r.ko === "string") {
        out[r.id] = r.ko.trim();
      }
    }
    return out;
  } catch (e) {
    console.warn(`[translate] LLM 호출 실패: ${e.message} — 사전 fallback`);
    return texts.map(() => null);
  } finally {
    clearTimeout(timer);
  }
}

// ── 메인 ──────────────────────────────────────────────
async function translateItems(items, args, cache) {
  // 1) 번역이 필요한 텍스트 수집 (영어 + 캐시 미스)
  const tasks = []; // { item, field, text }
  for (const it of items) {
    for (const field of ["title", "summary", "description"]) {
      const text = it[field];
      if (!text || typeof text !== "string") continue;
      const koField = `${field}_ko`;
      if (it[koField]) continue; // 이미 번역됨
      if (isKorean(text)) {
        // 한국어 원문 → 추가 작업 불필요 (한글 우선 표시)
        it[koField] = text;
        continue;
      }
      const ck = cacheKey(text);
      if (cache[ck]) {
        it[koField] = cache[ck];
        continue;
      }
      tasks.push({ item: it, field: koField, text, ck });
    }
  }

  if (!tasks.length) {
    console.log("[translate] 모든 항목이 이미 한국어이거나 캐시 hit.");
    return;
  }

  console.log(`[translate] 번역 대상 ${tasks.length}개 (LLM=${args.llm ? "ON" : "OFF"}, batch=${args.batch})`);

  if (!args.llm) {
    // 사전 기반 간이 변환만
    for (const t of tasks) {
      const ko = simpleTranslate(t.text);
      t.item[t.field] = ko;
      cache[t.ck] = ko;
    }
    return;
  }

  // 2) LLM 일괄 번역 — N개씩 batch
  const BATCH = Math.max(1, Math.min(20, args.batch));
  let processed = 0;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const chunk = tasks.slice(i, i + BATCH);
    const texts = chunk.map((t) => t.text.slice(0, 500)); // 500자 cap (LLM context)
    const t0 = Date.now();
    const results = await llmTranslateBatch(texts);
    for (let j = 0; j < chunk.length; j++) {
      const ko = results[j] || simpleTranslate(chunk[j].text); // LLM 실패 시 사전 fallback
      chunk[j].item[chunk[j].field] = ko;
      cache[chunk[j].ck] = ko;
    }
    processed += chunk.length;
    const dt = Date.now() - t0;
    process.stdout.write(`\r[translate] ${processed}/${tasks.length} 처리 (배치 ${dt}ms)`);
  }
  process.stdout.write("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.in)) {
    console.error(`✖ 입력 파일 없음: ${args.in}`);
    process.exit(1);
  }
  const t0 = Date.now();
  const data = JSON.parse(fs.readFileSync(args.in, "utf8"));
  const cache = loadCache();
  const initialCacheSize = Object.keys(cache).length;

  // 4개 도메인 모두 처리 (research 포함 — Round 5)
  for (const arr of [data.news, data.community, data.oss, data.research]) {
    if (Array.isArray(arr)) await translateItems(arr, args, cache);
  }

  saveCache(cache);
  const cacheGrowth = Object.keys(cache).length - initialCacheSize;

  // 출력 — 인덴트 없이 (Round 4 perf 정책)
  fs.writeFileSync(args.out, JSON.stringify(data));
  const dt = Date.now() - t0;
  console.log(`[translate] 완료 · ${args.out} · 캐시 ${initialCacheSize} → ${Object.keys(cache).length} (+${cacheGrowth}) · ${dt}ms`);
}

if (require.main === module) {
  main().catch((e) => { console.error(`[translate] 실패: ${e.message}`); process.exit(1); });
}

module.exports = { translateItems, isKorean, simpleTranslate, llmTranslateBatch };
