/**
 * perf.js — Real User Monitoring 라이트.
 *
 * spec § 2.2 "5초 안에 핵심 파악" → LCP가 진짜 충족되는지 측정.
 *
 * 캡처:
 *   - LCP (Largest Contentful Paint) — 핵심 콘텐츠가 사용자 시야에 들어온 시각
 *   - CLS (Cumulative Layout Shift)   — 누적 레이아웃 흔들림
 *   - INP (Interaction to Next Paint) — 첫 인터랙션 응답 지연
 *   - DCL (DOMContentLoaded)          — 부트 시작
 *   - LOAD (load event)               — 모든 리소스 로드 완료
 *
 * 노출:
 *   window.DN_PERF = { lcp, cls, inp, dcl, load, navigationType, started }
 *   `dn:perf` CustomEvent — 각 메트릭이 확정되면 dispatch (Playwright/RUM 수집용)
 *
 * 파일프로토콜에서도 동작 (PerformanceObserver는 file://에서도 동작).
 * SafariBrowser/구형 환경에서 PerformanceObserver 미지원 시 silent skip.
 *
 * 의존: 0 — 브라우저 표준 API만.
 */
(function () {
  "use strict";

  if (typeof PerformanceObserver === "undefined") return;

  const perf = {
    lcp: null, cls: 0, inp: null,
    dcl: null, load: null,
    navigationType: (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]?.type) || "navigate",
    started: performance.now(),
  };
  window.DN_PERF = perf;

  function emit(metric, value) {
    perf[metric] = value;
    try {
      window.dispatchEvent(new CustomEvent("dn:perf", { detail: { metric, value, all: perf } }));
    } catch (e) { /* IE-style CustomEvent fallback unneeded — modern browsers */ }
  }

  // LCP — 마지막 entry가 진짜 LCP. tab visibility 변화 시 stop.
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (!entries.length) return;
      const last = entries[entries.length - 1];
      emit("lcp", Math.round(last.renderTime || last.loadTime || last.startTime));
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    // First user input or page hide finalizes LCP
    const stopLcp = () => { try { lcpObs.disconnect(); } catch (e) {} };
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") stopLcp(); }, { once: true });
    addEventListener("pagehide", stopLcp, { once: true });
  } catch (e) { /* unsupported */ }

  // CLS — 누적
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) emit("cls", Math.round((perf.cls + entry.value) * 1000) / 1000);
      }
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
  } catch (e) { /* unsupported */ }

  // INP — 첫 interaction 후 다음 paint까지 (event Timing API)
  try {
    let worstInp = 0;
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId) {
          const dur = Math.round(entry.duration);
          if (dur > worstInp) {
            worstInp = dur;
            emit("inp", dur);
          }
        }
      }
    });
    inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch (e) { /* unsupported */ }

  // DCL + LOAD
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", () => emit("dcl", Math.round(performance.now())), { once: true });
  } else {
    emit("dcl", Math.round(performance.now()));
  }
  addEventListener("load", () => emit("load", Math.round(performance.now())), { once: true });
})();
