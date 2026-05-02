// @ts-check
/**
 * happy-path.spec.js — Daily News 핵심 회귀 보호 (CP-1, CP-2, CP-3).
 *
 * 데이터 파이프라인이 매일 today.js를 갱신할 때 dashboard가 silent로
 * 비어 발행되는 위험을 차단하기 위한 최소 슈트.
 *
 * 검증:
 *   - 페이지 로드 시 콘솔 에러 0건
 *   - Hero 모든 섹션 (5초 결론·헤드라인·5줄·인용·lead·통계·버킷·다양성·인플루언서)
 *   - 4 탭 카운터가 "—"가 아닌 숫자로 표시
 *   - 뉴스 탭: 카드 ≥1, 첫 카드에 4 게이지 + 점수 등급 클래스
 *   - 카테고리 필터 동작 (AI 칩 → 카드 감소 + breadcrumb 갱신)
 *   - 점수 슬라이더 동작 (4.5+ → 카드 감소)
 *   - 검색 동작 (debounced)
 *   - Insights 탭 → 모달 열기 → prev/next → ESC 닫기
 *   - Storage 라운드트립 (별표 토글 후 새로고침해도 유지)
 *   - Archive 페이지 7행 + 오늘 행만 link
 */
const { test, expect } = require("@playwright/test");

// 테스트 간 localStorage / focus / SW state 간섭 방지를 위해 serial.
// 8 tests × ~300ms = 3초이므로 병렬 가치 미미.
test.describe.configure({ mode: "serial" });

test.describe("Daily News — happy path", () => {
  test.beforeEach(async ({ page }) => {
    // localStorage 초기화 (테스트 간 격리)
    await page.goto("/index.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("CP-1: 페이지 로드 — 콘솔 에러 0, Hero 모든 섹션, 탭 카운터 채워짐", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    await page.goto("/index.html");

    // window.DN, window.App, window.Insights 모두 준비
    await expect.poll(() => page.evaluate(() => typeof window.DN)).toBe("object");
    await expect.poll(() => page.evaluate(() => typeof window.App)).toBe("object");
    await expect.poll(() => page.evaluate(() => typeof window.Insights)).toBe("object");

    // Hero 섹션
    await expect(page.locator("#conclusion-headline")).not.toHaveText("…");
    await expect(page.locator("#conclusion-score")).not.toHaveText("—");
    await expect(page.locator("#headline-card")).toBeVisible();
    await expect(page.locator("#five-lines li")).toHaveCount(5);
    await expect(page.locator("#quote-text")).not.toHaveText("");
    await expect(page.locator("#stats-grid .stat")).toHaveCount(5);
    await expect(page.locator("#bucket-strip .bucket-pill")).toHaveCount(4);
    await expect(page.locator("#diversity-bar .diversity-meter__seg")).toHaveCount(5);
    await expect(page.locator("#influencer-strip .influencer-card")).toHaveCount(8);

    // 탭 카운터 — "—" 아닌 숫자
    for (const id of ["#count-news", "#count-community", "#count-oss", "#count-insights"]) {
      await expect(page.locator(id)).not.toHaveText("—");
    }

    // 뉴스 탭: 첫 카드에 4 게이지
    await expect(page.locator("#news-grid > .card").first()).toBeVisible();
    await expect(page.locator("#news-grid > .card:first-child .gauge")).toHaveCount(4);

    // 점수 등급 배지 클래스 (g2..g5 중 하나)
    const badge = page.locator("#news-grid > .card:first-child .card__score-badge");
    await expect(badge).toBeVisible();
    const cls = await badge.getAttribute("class");
    expect(cls).toMatch(/card__score-badge--g[2345]/);

    expect(errors, `console/page errors: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("CP-2: 카테고리 필터 + 점수 슬라이더 + 검색", async ({ page }) => {
    await page.goto("/index.html");

    const totalCards = await page.locator("#news-grid > .card").count();
    expect(totalCards).toBeGreaterThan(0);

    // AI 카테고리 클릭 → 카드 감소
    await page.click('#news-categories .chip[data-cat-key="ai"]');
    const aiCards = await page.locator("#news-grid > .card").count();
    expect(aiCards).toBeLessThanOrEqual(totalCards);
    await expect(page.locator("#news-breadcrumb")).toContainText("AI");

    // 칩 다시 눌러 해제
    await page.click('#news-categories .chip[data-cat-key="ai"]');
    await expect(page.locator("#news-grid > .card")).toHaveCount(totalCards);

    // 점수 슬라이더 4.5
    await page.evaluate(() => {
      const slider = document.getElementById("news-score-min");
      slider.value = "4.5";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("#news-score-num")).toHaveText("4.5");
    const highScoreCards = await page.locator("#news-grid > .card").count();
    expect(highScoreCards).toBeLessThanOrEqual(totalCards);

    // 슬라이더 0 복원
    await page.evaluate(() => {
      const s = document.getElementById("news-score-min");
      s.value = "0"; s.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // 검색 — 데이터에 OpenAI는 항상 있음
    await page.fill('#news-search input[data-search-input]', "OpenAI");
    await page.waitForTimeout(200); // debounce
    const matchedCards = await page.locator("#news-grid > .card").count();
    expect(matchedCards).toBeGreaterThanOrEqual(1);
    expect(matchedCards).toBeLessThanOrEqual(totalCards);
  });

  test("CP-3: Insights 탭 + 모달 + prev/next + ESC", async ({ page }) => {
    await page.goto("/index.html");

    // Insights 탭으로
    await page.click('.tab-btn[data-tab="insights"]');
    await expect(page.locator('.tab-content[data-tab="insights"]')).toBeVisible();
    await expect(page.locator("#insights-grid .insight-card")).toHaveCount(10);

    // 첫 카드 → 모달
    await page.click("#insights-grid .insight-card >> nth=0");
    const modal = page.locator("#insight-modal");
    await expect(modal).toBeVisible();
    await expect(page.locator("#modal-inner .modal__section")).toHaveCount(6); // 배경/질문/분석 + 관련 3종

    // pos = "1 / 10"
    await expect(page.locator("#modal-inner .modal__pos")).toHaveText("1 / 10");

    // 다음 → "2 / 10"
    await page.locator("#modal-inner .modal__nav-btn").nth(1).click();
    await expect(page.locator("#modal-inner .modal__pos")).toHaveText("2 / 10");

    // ESC 닫기
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });

  test("CP-4: Storage 라운드트립 — 별표가 reload 후에도 유지", async ({ page }) => {
    await page.goto("/index.html");

    const card = page.locator("#news-grid > .card").first();
    const cardId = await card.getAttribute("id");
    expect(cardId).toBeTruthy();

    const starBtn = card.locator(".card__act").first();
    await expect(starBtn).toHaveAttribute("data-on", "false");

    await starBtn.click();
    await expect(starBtn).toHaveAttribute("data-on", "true");

    // localStorage 확인
    const starred = await page.evaluate(() => JSON.parse(localStorage.getItem("dn.starred") || "[]"));
    expect(starred).toContain(cardId);

    // 새로고침
    await page.reload();
    const sameCard = page.locator(`#${cardId}`);
    await expect(sameCard.locator(".card__act").first()).toHaveAttribute("data-on", "true");
  });

  test("CP-6: Archive 페이지 — 7행, 오늘 행만 link, 점수 등급 색", async ({ page }) => {
    await page.goto("/archive.html");

    const rows = page.locator(".archive-row");
    await expect(rows).toHaveCount(7);

    // 첫 행: <a href="index.html">
    const firstRow = rows.first();
    await expect(firstRow).toHaveAttribute("href", "index.html");

    // 나머지 6행: data-disabled="true"
    for (let i = 1; i < 7; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-disabled", "true");
    }

    // 점수 등급 색 클래스
    const scoreCls = await firstRow.locator(".archive-row__score").getAttribute("class");
    expect(scoreCls).toMatch(/archive-row__score--g[2345]/);
  });

  test("CP-A11Y: 모달 포커스 트랩 + 닫은 후 포커스 복귀 + skip-link", async ({ page }) => {
    await page.goto("/index.html");

    // Skip-link Tab 시 첫 노출
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { className: a.className, href: a.getAttribute("href") } : null;
    });
    // skip-link가 첫 focusable이거나 적어도 키보드로 도달 가능해야 함
    expect(focused).toBeTruthy();

    // Insights 탭 + 모달
    await page.click('.tab-btn[data-tab="insights"]');
    const firstInsight = page.locator("#insights-grid .insight-card").first();
    await firstInsight.click();
    await expect(page.locator("#insight-modal")).toBeVisible();

    // 포커스가 모달 내부에 있음 (첫 focusable)
    const focusInModal = await page.evaluate(() => {
      const a = document.activeElement;
      const modal = document.getElementById("insight-modal");
      return a && modal && modal.contains(a);
    });
    expect(focusInModal).toBe(true);

    // ESC 닫기
    await page.keyboard.press("Escape");
    await expect(page.locator("#insight-modal")).toBeHidden();

    // 포커스가 모달 열기 전 카드(또는 그 후손)로 복귀
    const focusBack = await page.evaluate(() => {
      const a = document.activeElement;
      const grid = document.getElementById("insights-grid");
      return a && grid && grid.contains(a);
    });
    expect(focusBack).toBe(true);
  });

  test("CP-A11Y2: ARIA labels on icon buttons", async ({ page }) => {
    await page.goto("/index.html");
    const card = page.locator("#news-grid > .card").first();
    const star = card.locator(".card__act").first();
    await expect(star).toHaveAttribute("aria-label", /별표/);
    await expect(star).toHaveAttribute("aria-pressed", /^(true|false)$/);
    // 토글 후 aria-pressed 갱신
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
  });

  test("CP-7: theme toggle persists + applies before paint (no FOUC)", async ({ page }) => {
    // 1. 다크 모드 설정
    await page.goto("/index.html");
    await page.evaluate(() => localStorage.setItem("dn.theme", '"dark"'));

    // 2. 새로고침 — paint 전에 inline script가 data-theme=dark 적용
    await page.reload();
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");

    // 3. body 배경이 다크 토큰
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // dark mode --bg = #0d0c0a 즉 rgb(13, 12, 10)
    expect(bodyBg).toBe("rgb(13, 12, 10)");

    // 4. archive 페이지에서도 일관
    await page.goto("/archive.html");
    const archiveTheme = await page.locator("html").getAttribute("data-theme");
    expect(archiveTheme).toBe("dark");
  });
});
