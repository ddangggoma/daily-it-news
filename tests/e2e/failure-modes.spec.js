// @ts-check
/**
 * failure-modes.spec.js — dashboard가 데이터/스토리지 결손 시 우아하게 실패하는지.
 *
 * 자동 발행 파이프라인이 매일 돌면서 한 번이라도 깨지면 dashboard가 silent로
 * 비어 발행되거나 console error로 죽는다. 이 슈트는 그 회복력을 검증.
 *
 * 시나리오:
 *   FM-1: data/today.js 가 404 → console error 보존, 페이지 자체는 죽지 않음
 *   FM-2: data/today.js 가 평가 실패 (syntax error) → 동일
 *   FM-3: __DAILY__ 가 빈 객체 → 모든 카드 empty state, 충돌 없음
 *   FM-4: news[] 빈 배열 → "조건에 맞는 뉴스가 없습니다" empty
 *   FM-5: localStorage 차단 (security 모드) → Storage 함수 throw 안 함
 */
const { test, expect } = require("@playwright/test");

test.describe.configure({ mode: "serial" });

// ── 공통 헬퍼 ─────────────────────────────────────────
async function captureErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

// ── FM-1: today.js 404 ────────────────────────────────
test("FM-1: data/today.js 404 → 페이지 죽지 않음, 헤더는 정상", async ({ page }) => {
  const errors = await captureErrors(page);
  await page.route("**/data/today.js", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/index.html");
  // 헤더는 항상 존재 (HTML 정적)
  await expect(page.locator(".app-header")).toBeVisible();
  // 빈 dashboard도 페이지 자체는 살아있음
  await expect(page.locator("body")).toBeVisible();
  // top-level catch가 console.error로 처리 — pageerror 가 0건이어야 함 (uncaught throw 0)
  const uncaught = errors.filter((e) => e.startsWith("pageerror:"));
  expect(uncaught, `uncaught throws: ${uncaught.join("\n")}`).toHaveLength(0);
});

// ── FM-2: today.js syntax error ───────────────────────
test("FM-2: today.js 평가 실패 → 페이지 죽지 않음", async ({ page }) => {
  const errors = await captureErrors(page);
  // Intentionally broken JS that parses but throws at runtime
  await page.route("**/data/today.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "throw new Error('intentional');" })
  );
  await page.goto("/index.html");
  await expect(page.locator(".app-header")).toBeVisible();
  // 페이지 자체는 살아있음
  await expect(page.locator("body")).toBeVisible();
});

// ── FM-3: 빈 __DAILY__ ────────────────────────────────
test("FM-3: __DAILY__ 빈 객체 → 충돌 없음, empty state 표시", async ({ page }) => {
  const errors = await captureErrors(page);
  await page.route("**/data/today.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "window.__DAILY__ = {};" })
  );
  await page.goto("/index.html");
  // 헤더 + body 살아있음
  await expect(page.locator(".app-header")).toBeVisible();
  // 카드 그리드는 빈 상태 (count = 0)
  const newsCards = await page.locator("#news-grid > .card").count();
  expect(newsCards).toBe(0);
  // pageerror 0
  const uncaught = errors.filter((e) => e.startsWith("pageerror:"));
  expect(uncaught, `uncaught throws: ${uncaught.join("\n")}`).toHaveLength(0);
});

// ── FM-4: news[] 빈 → empty state 메시지 ──────────────
test("FM-4: news[] 빈 → empty state 메시지", async ({ page }) => {
  const minimalDaily = {
    date: "2026-05-01",
    generatedAt: "2026-05-01T21:00:00Z",
    conclusion: { headline: "no news today", scoreAvg: 0, vs7d: 0 },
    counts: { news: 0, community: 0, oss: 0, insights: 0 },
    fiveLines: [],
    quote: { text: "—", author: "—", role: "—", url: "" },
    lead: "—",
    stats: { newsTotal: 0, score45plus: 0, categoriesActive: 0, insights: 0, todayVs7d: 0, todayVs7dPercent: 0 },
    buckets: { yesterday: { label: "어제", count: 0, active: true } },
    sourceDiversity: [],
    influencers: [],
    news: [], community: [], oss: [], insights: [],
  };
  await page.route("**/data/today.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: `window.__DAILY__ = ${JSON.stringify(minimalDaily)};` })
  );
  await page.goto("/index.html");
  // empty state 메시지 노출 (filterNews 빈 결과 분기)
  await expect(page.locator("#news-grid .empty")).toBeVisible();
});

// ── FM-5: localStorage 차단 ────────────────────────────
test("FM-5: localStorage 차단 → Storage 함수가 throw 안 함", async ({ page }) => {
  const errors = await captureErrors(page);
  // Override before page scripts run.
  await page.addInitScript(() => {
    // Intercept localStorage.setItem / getItem to throw — simulates "Block all storage" mode.
    const denyError = new Error("SecurityError: localStorage blocked");
    Object.defineProperty(Storage.prototype, "setItem", { value: () => { throw denyError; } });
    Object.defineProperty(Storage.prototype, "getItem", { value: () => { throw denyError; } });
  });
  await page.goto("/index.html");
  await expect(page.locator(".app-header")).toBeVisible();
  // 별표 토글 시도 — Storage.toggleFlag 가 throw 하면 ★ 클릭이 페이지를 죽이게 됨
  const star = page.locator("#news-grid > .card .card__act").first();
  if (await star.count()) {
    await star.click().catch(() => { /* ignore — 우리가 검증하는 것은 페이지 자체가 살아있는지 */ });
  }
  // 페이지 자체는 살아 있어야 함
  await expect(page.locator("body")).toBeVisible();
  // pageerror 0
  const uncaught = errors.filter((e) => e.startsWith("pageerror:"));
  expect(uncaught, `uncaught throws: ${uncaught.join("\n")}`).toHaveLength(0);
});
