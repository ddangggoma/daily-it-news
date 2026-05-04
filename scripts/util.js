/**
 * util.js — Daily News 공유 헬퍼.
 *
 * 노출: window.DN = { el, $, $$, escapeHtml, scoreGrade, avgScore,
 *                    fmtScore, fmtNum, fmtRelTime, fmtKstNow, debounce,
 *                    CATEGORIES, CATEGORY_BY_KEY, COUNTRY_FLAG, GAUGES,
 *                    INSIGHT_TAGS, OSS_TYPES }
 *
 * insights.js, app.js, archive.html이 destructuring으로 사용.
 * 로드 순서: data/* → util.js → storage.js → insights.js → app.js
 *
 * 의존: 없음 (브라우저 표준 API만)
 */
(function () {
  "use strict";

  // ── 상수 (기존 app.js와 insights.js에 흩어져 있던 것들 통합) ──

  // 🆕 Round 9: 카테고리 재구성 — 8개 기본 + 5개 추가 + 2개 research 별도 탭.
  // spec.js와 동기 (drift test가 차이 감지).
  const CATEGORIES = [
    { key: "ai",          icon: "🤖", label: "AI" },
    { key: "devtools",    icon: "🛠",  label: "Dev Tools" },
    { key: "ax",          icon: "🎯", label: "AX" },
    { key: "robotics",    icon: "⚙️", label: "로봇" },
    { key: "display",     icon: "📺", label: "디스플레이" },
    { key: "design",      icon: "🎨", label: "디자인" },
    { key: "telecom",     icon: "📡", label: "통신" },
    { key: "data",        icon: "📊", label: "데이터" },
    { key: "security",    icon: "🔒", label: "보안" },
    { key: "cloud",       icon: "☁️", label: "클라우드" },
    { key: "semiconductor", icon: "🔬", label: "반도체" },
    { key: "mobile",      icon: "📱", label: "모바일" },
    { key: "startup",     icon: "🚀", label: "스타트업" },
    { key: "papers",      icon: "📄", label: "논문" },
    { key: "standards",   icon: "⚖️", label: "특허/표준" },
  ];
  const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

  const GAUGES = [
    { key: "impact",    icon: "🎯", label: "파급력",
      tooltip: "산업·시장 구조 변화 + 의사결정자 행동 변화" },
    { key: "freshness", icon: "⚡", label: "시의성",
      tooltip: "게시 시점 + 1차 보도 여부 + 후속 보도 비율" },
    { key: "depth",     icon: "🔬", label: "기술도",
      tooltip: "기술 난이도·구현 디테일·재현 가능성·외부 검증" },
    { key: "buzz",      icon: "🔥", label: "반응도",
      tooltip: "커뮤니티·SNS 반응 + 시간당 증가율 + 즉시 적용성" },
  ];

  const COUNTRY_FLAG = {
    US: "🇺🇸", KR: "🇰🇷", Global: "🌍", CN: "🇨🇳",
    EU: "🇪🇺", JP: "🇯🇵", IN: "🇮🇳",
  };

  const INSIGHT_TAGS = {
    opportunity: { label: "💡 기회",  color: "#a855f7" },
    pattern:     { label: "📜 패턴",  color: "#7c2d12" },
    caution:     { label: "⚠ 경계",   color: "#ef4444" },
    bullish:     { label: "📈 강세",  color: "#10b981" },
  };

  // 🆕 Round 9: OSS 세부분류 확장 — security/database/devops/web/mobile 추가.
  // 기존 7종 (agent/framework/library/tool/runtime/model/dataset) + 신규 6종.
  const OSS_TYPES = [
    { key: "all",       label: "전체" },
    { key: "trending",  label: "🔥 트렌딩" },
    { key: "korean",    label: "🇰🇷 한국" },
    { key: "agent",     label: "🤖 에이전트" },
    { key: "model",     label: "🧠 모델" },
    { key: "framework", label: "🏗 프레임워크" },
    { key: "library",   label: "📚 라이브러리" },
    { key: "tool",      label: "🔧 도구" },
    { key: "runtime",   label: "⚡ 런타임" },
    { key: "dataset",   label: "📊 데이터셋" },
    // Round 9 신규
    { key: "security",  label: "🔒 보안" },
    { key: "database",  label: "🗄 DB·스토리지" },
    { key: "devops",    label: "☸️ DevOps" },
    { key: "web",       label: "🌐 웹·UI" },
    { key: "mobile",    label: "📱 모바일" },
    { key: "data",      label: "📈 데이터" },
  ];

  // ── DOM 헬퍼 ────────────────────────────────────────────

  function $(sel, root)  { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /**
   * el — DOM 빌더. children에 null/false는 스킵 (조건부 렌더 친화적).
   *
   * @example
   *   el("div", { className: "card", onclick: handler },
   *     el("h2", null, "Title"),
   *     condition && el("span", null, "extra")
   *   )
   *
   * 특수 attrs:
   *   className → 그대로 className 할당
   *   style     → setAttribute("style", ...)
   *   html      → innerHTML 직접 (escape 책임은 호출자)
   *   on*       → addEventListener (camelCase → lowercase)
   *   기타      → setAttribute. value가 null/false면 무시.
   */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (k === "className")        node.className = v;
        else if (k === "style")       node.setAttribute("style", v);
        else if (k === "html")        node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v != null && v !== false) {
          node.setAttribute(k, v);
        }
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" || typeof c === "number"
        ? document.createTextNode(String(c))
        : c);
    }
    return node;
  }

  /** XSS-safe HTML escape (5 chars). */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ── 점수 / 포맷 ─────────────────────────────────────────

  /** 4기준 평균 (소수점 1자리 출력은 fmtScore에서). */
  function avgScore(scores) {
    if (!scores) return 0;
    const arr = ["impact", "freshness", "depth", "buzz"].map((k) => Number(scores[k] || 0));
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /** 등급 (5: 빨강 / 4: 주황 / 3: 청록 / 2: 회색). */
  function scoreGrade(n) {
    return n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : 2;
  }

  function fmtScore(n) { return n == null ? "—" : Number(n).toFixed(1); }
  function fmtNum(n)   { return n == null ? "—" : Number(n).toLocaleString(); }

  /** "n분 전" / "n시간 전" / "n일 전". invalid → "". */
  function fmtRelTime(iso) {
    if (!iso) return "";
    const t = Date.parse(iso);
    if (isNaN(t)) return "";
    const diffMin = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (diffMin < 60) return `${diffMin}분 전`;
    const h = Math.round(diffMin / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.round(h / 24)}일 전`;
  }

  /** "2026. 5. 2. 오후 12:13" 같은 KST 표시. */
  function fmtKstNow() {
    const opts = {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    };
    return new Intl.DateTimeFormat("ko-KR", opts).format(new Date());
  }

  /** "5월 1일 (목)" 같은 짧은 KST 일자. iso는 "YYYY-MM-DD". */
  function fmtKstShortDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00+09:00");
    if (isNaN(d.getTime())) return iso;
    const opts = { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" };
    return new Intl.DateTimeFormat("ko-KR", opts).format(d);
  }

  // ── 함수 헬퍼 ───────────────────────────────────────────

  /** trailing-edge debounce. */
  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(this, args), ms || 200);
    };
  }

  /** 별점 문자열. score는 0..5 실수, 반올림. */
  function stars(score) {
    const full = Math.round(score);
    const safe = Math.max(0, Math.min(5, full));
    return "★".repeat(safe) + "☆".repeat(5 - safe);
  }

  // ── 노출 ────────────────────────────────────────────────
  window.DN = {
    el, $, $$, escapeHtml,
    avgScore, scoreGrade, fmtScore, fmtNum,
    fmtRelTime, fmtKstNow, fmtKstShortDate,
    debounce, stars,
    CATEGORIES, CATEGORY_BY_KEY, COUNTRY_FLAG,
    GAUGES, INSIGHT_TAGS, OSS_TYPES,
  };
})();
