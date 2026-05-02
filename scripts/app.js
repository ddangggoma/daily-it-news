/**
 * app.js — Daily News 메인 런타임.
 *
 * 책임:
 *   - Hero 섹션 렌더 (5초 결론, 헤드라인, 5줄 요약, 인용, 에디토리얼, 통계, 버킷, 다양성, 인플루언서)
 *   - 4-탭 라우터 (뉴스/커뮤니티/오픈소스/인사이트)
 *   - 뉴스 탭: 9 카테고리 칩 + 점수 슬라이더 + 검색 + 다중선택 + 저장된 뷰 + 4기준 게이지 카드
 *   - 커뮤니티 탭: 소스 칩 + 카테고리 칩 + 정렬(🔥/⏱) + 카드
 *   - 오픈소스 탭: 타입 칩 + 카드
 *   - 인사이트 탭: Insights.init() 위임
 *   - 헤더 액션 (테마, gmail, 푸터)
 *
 * 노출 (insights.js가 사용):
 *   window.App = { renderGauges, renderMiniGauges, switchTab, focusItem }
 *
 * 의존: window.__DAILY__, window.__EXPERTS__, window.__ARCHIVE__, window.Storage, window.Insights
 */
(function () {
  "use strict";

  // ───────────────────────────────────────────────────────
  // 1. 상수
  // ───────────────────────────────────────────────────────
  const CATEGORIES = [
    { key: "ai",        icon: "🤖", label: "AI / Agent" },
    { key: "devtools",  icon: "🛠", label: "DevTools" },
    { key: "ax",        icon: "🎯", label: "AX 방법론·문화" },
    { key: "robotics",  icon: "⚙️", label: "로봇" },
    { key: "display",   icon: "📺", label: "디스플레이" },
    { key: "design",    icon: "🎨", label: "디자인" },
    { key: "papers",    icon: "📄", label: "논문" },
    { key: "standards", icon: "⚖️", label: "특허/표준" },
    { key: "telecom",   icon: "📡", label: "통신" },
  ];
  const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

  const GAUGES = [
    { key: "impact",     icon: "🎯", label: "파급력",
      tooltip: "산업·시장 구조 변화 + 의사결정자 행동 변화" },
    { key: "freshness",  icon: "⚡", label: "시의성",
      tooltip: "게시 시점 + 1차 보도 여부 + 후속 보도 비율" },
    { key: "depth",      icon: "🔬", label: "기술도",
      tooltip: "기술 난이도·구현 디테일·재현 가능성·외부 검증" },
    { key: "buzz",       icon: "🔥", label: "반응도",
      tooltip: "커뮤니티·SNS 반응 + 시간당 증가율 + 즉시 적용성" },
  ];

  const COUNTRY_FLAG = {
    US: "🇺🇸", KR: "🇰🇷", Global: "🌍", CN: "🇨🇳", EU: "🇪🇺", JP: "🇯🇵", IN: "🇮🇳",
  };

  const OSS_TYPES = [
    { key: "all",       label: "전체" },
    { key: "trending",  label: "🔥 trending" },
    { key: "korean",    label: "🇰🇷 한국" },
    { key: "agent",     label: "agent" },
    { key: "framework", label: "framework" },
    { key: "library",   label: "library" },
    { key: "tool",      label: "tool" },
    { key: "runtime",   label: "runtime" },
    { key: "model",     label: "model" },
    { key: "dataset",   label: "dataset" },
  ];

  // ───────────────────────────────────────────────────────
  // 2. 유틸
  // ───────────────────────────────────────────────────────
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "className") node.className = attrs[k];
        else if (k === "style") node.setAttribute("style", attrs[k]);
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === "string" || typeof c === "number"
        ? document.createTextNode(String(c)) : c);
    }
    return node;
  }

  const fmtScore = (n) => (n == null ? "—" : Number(n).toFixed(1));
  const scoreGrade = (n) => n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : 2;
  const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString());

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(() => fn.apply(this, args), ms || 200);
    };
  }

  function fmtRelTime(iso) {
    if (!iso) return "";
    const t = Date.parse(iso);
    if (isNaN(t)) return "";
    const diffMin = Math.max(1, Math.round((Date.now() - t) / 60000));
    if (diffMin < 60) return `${diffMin}분 전`;
    const h = Math.round(diffMin / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.round(h / 24);
    return `${d}일 전`;
  }

  function fmtKstNow() {
    const d = new Date();
    const opts = { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
    return new Intl.DateTimeFormat("ko-KR", opts).format(d);
  }

  // ───────────────────────────────────────────────────────
  // 3. 게이지 렌더 (4기준 × 게이지)
  // ───────────────────────────────────────────────────────
  function renderGauges(scores, opts) {
    opts = opts || {};
    const wrap = el("div", { className: "gauges" + (opts.mini ? " gauges--mini" : "") });
    GAUGES.forEach((g) => {
      const v = Number(scores && scores[g.key] != null ? scores[g.key] : 0);
      const pct = Math.max(0, Math.min(100, (v / 5) * 100));
      const node = el("div", { className: `gauge gauge--${g.key}`, title: g.tooltip },
        el("div", { className: "gauge__head" },
          el("span", { className: "gauge__label" }, `${g.icon} ${g.label}`),
          el("span", { className: "gauge__num" }, fmtScore(v))
        ),
        el("div", { className: "gauge__bar" },
          el("div", { className: "gauge__fill", style: `width:${pct}%` })
        )
      );
      wrap.appendChild(node);
    });
    return wrap;
  }

  function renderMiniGauges(scores) {
    return renderGauges(scores, { mini: true });
  }

  // ───────────────────────────────────────────────────────
  // 4. Hero 렌더
  // ───────────────────────────────────────────────────────
  function renderHero() {
    const D = window.__DAILY__ || {};

    // 5초 결론 바
    const c = D.conclusion || {};
    setText("#conclusion-headline", c.headline || "—");
    setText("#conclusion-score", fmtScore(c.scoreAvg));
    const delta = c.vs7d;
    if (delta != null) {
      const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
      setText("#conclusion-delta", `${arrow} ${Math.abs(delta).toFixed(2)}`);
    }

    // 헤드라인 카드
    const headline = (D.news || []).find((n) => n.headline) || (D.news || [])[0];
    if (headline) {
      const link = $("#headline-title-link");
      if (link) { link.textContent = headline.title; link.href = headline.url; link.target = "_blank"; link.rel = "noopener"; }
      setText("#headline-summary", headline.summary || "");
      const meta = $("#headline-meta");
      if (meta) {
        meta.innerHTML = "";
        meta.appendChild(el("span", { className: "headline-card__src" },
          `${COUNTRY_FLAG[headline.sourceCountry] || ""} ${headline.source || ""}`));
        meta.appendChild(el("span", { className: "headline-card__time" }, fmtRelTime(headline.publishedAt)));
        const cat = CATEGORY_BY_KEY[headline.category];
        if (cat) meta.appendChild(el("span", { className: "headline-card__cat" }, `${cat.icon} ${cat.label}`));
        meta.appendChild(el("span", { className: "headline-card__score" },
          `종합 ${fmtScore(avgScore(headline.scores))}`));
      }
    }

    // 5줄 요약
    const ol = $("#five-lines");
    if (ol) {
      ol.innerHTML = "";
      (D.fiveLines || []).forEach((line) => {
        const li = el("li", null,
          el("span", { className: "five-lines__text" }, line.text),
          line.anchorId ? el("a", {
            className: "five-lines__jump",
            href: `#${line.anchorId}`,
            onclick: (e) => { e.preventDefault(); focusItem(line.anchorId); },
          }, "→ 카드") : null
        );
        ol.appendChild(li);
      });
    }

    // 인용
    const q = D.quote || {};
    setText("#quote-text", q.text ? `"${q.text}"` : "");
    const auth = $("#quote-author");
    if (auth) {
      auth.innerHTML = "";
      if (q.author) auth.appendChild(el("strong", null, q.author));
      if (q.role) auth.appendChild(el("span", null, ` · ${q.role}`));
      if (q.url) {
        auth.appendChild(el("a", {
          href: q.url, target: "_blank", rel: "noopener",
          className: "quote-card__link"
        }, " 원문 →"));
      }
    }

    // Lead + stats
    setText("#lead-text", D.lead || "");
    const stats = $("#stats-grid");
    if (stats) {
      stats.innerHTML = "";
      const s = D.stats || {};
      const items = [
        { label: "뉴스 합계", value: s.newsTotal },
        { label: "★ 4.5+", value: s.score45plus },
        { label: "활성 카테고리", value: s.categoriesActive },
        { label: "전문가 분석", value: s.insights },
        { label: "오늘 vs 7일", value: s.todayVs7d != null ? `${s.todayVs7d > 0 ? "+" : ""}${s.todayVs7d.toFixed(2)}` : "—" },
      ];
      items.forEach((it) => {
        stats.appendChild(el("div", { className: "stat" },
          el("div", { className: "stat__num" }, it.value != null ? it.value : "—"),
          el("div", { className: "stat__label" }, it.label)
        ));
      });
    }

    // 일자 버킷 (hero용)
    renderBucketStrip("#bucket-strip", D.buckets || {}, true);

    // 소스 다양성 미터
    renderDiversity(D.sourceDiversity || []);

    // 인플루언서
    renderInfluencers(D.influencers || []);
  }

  function avgScore(s) {
    if (!s) return 0;
    const arr = ["impact", "freshness", "depth", "buzz"].map((k) => Number(s[k] || 0));
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function renderBucketStrip(target, buckets, isHero) {
    const root = $(target);
    if (!root) return;
    root.innerHTML = "";
    const order = ["yesterday", "today", "archival", "all"];
    order.forEach((key) => {
      const b = buckets[key];
      if (!b) return;
      const pill = el("button", {
        className: "bucket-pill",
        "data-bucket": key,
        "data-active": b.active ? "true" : "false",
      },
        el("span", { className: "bucket-pill__label" }, b.label),
        el("span", { className: "bucket-pill__count" }, String(b.count != null ? b.count : 0))
      );
      if (!isHero) {
        // 뉴스 탭의 버킷은 필터로 동작
        pill.addEventListener("click", () => {
          state.bucket = state.bucket === key ? null : key;
          $$(`${target} .bucket-pill`).forEach((p) => p.setAttribute("data-active",
            p.dataset.bucket === state.bucket ? "true" : "false"));
          renderNewsGrid();
        });
      }
      root.appendChild(pill);
    });
  }

  function renderDiversity(arr) {
    const bar = $("#diversity-bar");
    const legend = $("#diversity-legend");
    if (!bar || !legend) return;
    bar.innerHTML = "";
    legend.innerHTML = "";
    arr.forEach((seg) => {
      bar.appendChild(el("div", {
        className: "diversity-meter__seg",
        style: `width:${seg.percent}%; background:${seg.color}`,
        title: `${seg.region} · ${seg.percent}%`,
      }));
      legend.appendChild(el("span", { className: "diversity-meter__item" },
        el("span", { className: "diversity-meter__dot", style: `background:${seg.color}` }),
        ` ${COUNTRY_FLAG[seg.region] || ""} ${seg.region} ${seg.percent}%`
      ));
    });
  }

  function renderInfluencers(arr) {
    const root = $("#influencer-strip");
    if (!root) return;
    root.innerHTML = "";
    const head = el("div", { className: "influencer-strip__head" }, "👀 추적 중인 인플루언서");
    root.appendChild(head);
    const wrap = el("div", { className: "influencer-strip__items" });
    arr.forEach((p) => {
      wrap.appendChild(el("div", { className: "influencer-card" },
        el("span", { className: "influencer-card__avatar" }, p.avatar || "👤"),
        el("div", { className: "influencer-card__body" },
          el("div", { className: "influencer-card__name" }, p.name || "",
            p.handle ? el("span", { className: "influencer-card__handle" }, ` ${p.handle}`) : null
          ),
          el("div", { className: "influencer-card__excerpt" }, p.postExcerpt || "")
        )
      ));
    });
    root.appendChild(wrap);
  }

  function setText(sel, v) {
    const n = $(sel);
    if (n) n.textContent = v == null ? "" : String(v);
  }

  // ───────────────────────────────────────────────────────
  // 5. 탭 라우터
  // ───────────────────────────────────────────────────────
  function setupTabRouter() {
    $$(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    // 카운터 채움
    const c = (window.__DAILY__ && window.__DAILY__.counts) || {};
    setText("#count-news", c.news != null ? c.news : "—");
    setText("#count-community", c.community != null ? c.community : "—");
    setText("#count-oss", c.oss != null ? c.oss : "—");
    setText("#count-insights", c.insights != null ? c.insights : "—");
  }

  function switchTab(tab) {
    $$(".tab-btn").forEach((b) =>
      b.setAttribute("data-active", b.dataset.tab === tab ? "true" : "false"));
    $$(".tab-content").forEach((sec) => {
      if (sec.dataset.tab === tab) sec.removeAttribute("hidden");
      else sec.setAttribute("hidden", "");
    });
  }

  // ───────────────────────────────────────────────────────
  // 6. 뉴스 탭 (필터 + 카드)
  // ───────────────────────────────────────────────────────
  const state = {
    categories: new Set(),  // 비어 있으면 전체
    bucket: null,
    scoreMin: 0,
    search: "",
    multiSelect: false,
    selectedIds: new Set(),
  };

  function setupNewsTab() {
    // 카테고리 칩
    const catRow = $("#news-categories");
    if (catRow) {
      catRow.innerHTML = "";
      catRow.appendChild(el("button", {
        className: "chip", "data-cat-key": "__all", "data-active": "true",
        onclick: () => { state.categories.clear(); refreshChips(); renderNewsGrid(); }
      }, "전체"));
      CATEGORIES.forEach((c) => {
        catRow.appendChild(el("button", {
          className: "chip",
          "data-cat-key": c.key,
          onclick: () => {
            if (state.categories.has(c.key)) state.categories.delete(c.key);
            else state.categories.add(c.key);
            refreshChips();
            renderNewsGrid();
          },
        }, `${c.icon} ${c.label}`));
      });
      function refreshChips() {
        $$(".chip", catRow).forEach((b) => {
          const k = b.dataset.catKey;
          const active = (k === "__all" && state.categories.size === 0) ||
            (k !== "__all" && state.categories.has(k));
          b.setAttribute("data-active", active ? "true" : "false");
        });
      }
    }

    // 뉴스용 버킷 strip (필터 동작)
    renderBucketStrip("#news-buckets", (window.__DAILY__ && window.__DAILY__.buckets) || {}, false);

    // 점수 슬라이더
    const slider = $("#news-score-min");
    const num = $("#news-score-num");
    if (slider && num) {
      slider.value = "0";
      num.textContent = "0.0";
      slider.addEventListener("input", () => {
        state.scoreMin = parseFloat(slider.value) || 0;
        num.textContent = state.scoreMin.toFixed(1);
        renderNewsGrid();
      });
    }

    // 검색
    const searchWrap = $("#news-search");
    if (searchWrap) {
      const input = $("input[data-search-input]", searchWrap);
      const clear = $("[data-search-clear]", searchWrap);
      if (input) {
        const onSearch = debounce(() => {
          state.search = (input.value || "").trim().toLowerCase();
          renderNewsGrid();
        }, 150);
        input.addEventListener("input", onSearch);
      }
      if (clear) {
        clear.addEventListener("click", () => {
          if (input) { input.value = ""; }
          state.search = "";
          renderNewsGrid();
        });
      }
    }

    // 다중 선택 토글
    const multiBtn = $("#news-multi-toggle");
    if (multiBtn) {
      multiBtn.addEventListener("click", () => {
        state.multiSelect = !state.multiSelect;
        if (!state.multiSelect) state.selectedIds.clear();
        multiBtn.setAttribute("data-active", state.multiSelect ? "true" : "false");
        const tb = $("#multi-toolbar");
        if (tb) (state.multiSelect ? tb.removeAttribute : tb.setAttribute).call(tb, "hidden", "");
        if (!state.multiSelect && tb) tb.setAttribute("hidden", "");
        renderNewsGrid();
      });
    }

    setupMultiToolbar();
    renderSavedViews();
    renderNewsGrid();
  }

  function filterNews(items) {
    const q = state.search;
    return (items || []).filter((n) => {
      if (state.categories.size && !state.categories.has(n.category)) return false;
      if (state.scoreMin > 0 && avgScore(n.scores) < state.scoreMin) return false;
      if (q) {
        const hay = [
          n.title, n.summary, n.source, n.sourceCountry,
          ...(n.tags || []),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // bucket: 데이터에 명시된 분류가 없으므로 'all' 외엔 모두 통과(데모 모드)
      // 실제 운영에서는 publishedAt 기반으로 yesterday/today 분류 가능.
      return true;
    });
  }

  function renderBreadcrumb() {
    const bc = $("#news-breadcrumb");
    if (!bc) return;
    const parts = ["전체"];
    if (state.categories.size) {
      parts.push(Array.from(state.categories).map((k) => CATEGORY_BY_KEY[k]?.label || k).join(" + "));
    }
    if (state.scoreMin > 0) parts.push(`★ ${state.scoreMin.toFixed(1)}+`);
    if (state.search) parts.push(`🔎 "${state.search}"`);
    bc.textContent = parts.join(" › ");
  }

  function renderNewsGrid() {
    const grid = $("#news-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const all = (window.__DAILY__ && window.__DAILY__.news) || [];
    const list = filterNews(all);

    setText("#news-counter", `${list.length}건 / 전체 ${all.length}`);
    renderBreadcrumb();

    if (!list.length) {
      grid.appendChild(el("div", { className: "empty" }, "조건에 맞는 뉴스가 없습니다. 필터를 완화해 보세요."));
      return;
    }

    list.forEach((n) => grid.appendChild(renderNewsCard(n)));
  }

  function renderNewsCard(n) {
    const cat = CATEGORY_BY_KEY[n.category] || { icon: "📰", label: n.category };
    const score = avgScore(n.scores);
    const grade = scoreGrade(score);

    const card = el("article", {
      className: "card" + (n.featured ? " card--featured" : ""),
      id: n.id, "data-id": n.id,
    });

    // head: 카테고리·소스·시각 + 점수 배지
    const head = el("div", { className: "card__head" },
      el("div", { className: "card__meta" },
        el("span", { className: "card__cat" }, `${cat.icon} ${cat.label}`),
        el("span", { className: "card__src" },
          `${COUNTRY_FLAG[n.sourceCountry] || ""} ${n.source || ""}`),
        el("span", { className: "card__time" }, fmtRelTime(n.publishedAt))
      ),
      el("div", { className: `card__score-badge card__score-badge--g${grade}` },
        el("span", { className: "card__score-num" }, fmtScore(score)),
        el("span", { className: "card__score-stars" }, stars(score))
      )
    );

    // body: 제목 + 요약
    const titleLink = el("a", {
      className: "card__title",
      href: n.url, target: "_blank", rel: "noopener",
    }, n.title || "");
    const body = el("div", { className: "card__body" },
      titleLink,
      el("p", { className: "card__summary" }, n.summary || "")
    );

    // 4 게이지
    const gauges = renderGauges(n.scores || {});

    // 태그
    const tags = el("div", { className: "card__tags" });
    (n.tags || []).forEach((t) => {
      tags.appendChild(el("span", { className: "card__tag" }, `#${t}`));
    });

    // foot: 액션
    const isStarred = window.Storage && window.Storage.isFlagged("starred", n.id);
    const isBkmk    = window.Storage && window.Storage.isFlagged("bookmarks", n.id);
    const isRead    = window.Storage && window.Storage.isFlagged("read", n.id);
    if (isRead) card.classList.add("card--read");

    const foot = el("div", { className: "card__foot" });

    if (state.multiSelect) {
      const cb = el("input", {
        type: "checkbox", className: "card__select",
        "aria-label": "선택",
      });
      cb.checked = state.selectedIds.has(n.id);
      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedIds.add(n.id);
        else state.selectedIds.delete(n.id);
        updateMultiCount();
      });
      foot.appendChild(cb);
    }

    const actStar = el("button", {
      className: "card__act",
      "data-on": isStarred ? "true" : "false",
      title: "별표",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("starred", n.id);
        actStar.setAttribute("data-on", on ? "true" : "false");
      },
    }, "⭐");
    const actBkmk = el("button", {
      className: "card__act",
      "data-on": isBkmk ? "true" : "false",
      title: "나중에 읽기",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("bookmarks", n.id);
        actBkmk.setAttribute("data-on", on ? "true" : "false");
      },
    }, "🔖");
    const actRead = el("button", {
      className: "card__act",
      "data-on": isRead ? "true" : "false",
      title: "읽음 처리",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("read", n.id);
        actRead.setAttribute("data-on", on ? "true" : "false");
        card.classList.toggle("card--read", on);
      },
    }, "✅");
    const actLink = el("a", {
      className: "card__act card__act--link",
      href: n.url, target: "_blank", rel: "noopener",
      title: "원문",
    }, "↗ 원문");

    foot.appendChild(actStar);
    foot.appendChild(actBkmk);
    foot.appendChild(actRead);
    foot.appendChild(actLink);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(gauges);
    if ((n.tags || []).length) card.appendChild(tags);
    card.appendChild(foot);

    return card;
  }

  function stars(score) {
    const full = Math.round(score);
    return "★".repeat(Math.max(0, Math.min(5, full))) + "☆".repeat(Math.max(0, 5 - full));
  }

  // 다중 선택 도구
  function setupMultiToolbar() {
    const tb = $("#multi-toolbar");
    if (!tb) return;
    $$("button[data-action]", tb).forEach((btn) => {
      btn.addEventListener("click", () => {
        const ids = Array.from(state.selectedIds);
        const action = btn.dataset.action;
        if (!ids.length && action !== "clear") return;
        if (action === "bookmark") ids.forEach((id) => window.Storage.setFlag("bookmarks", id, true));
        else if (action === "read") ids.forEach((id) => window.Storage.setFlag("read", id, true));
        else if (action === "copy") {
          const news = (window.__DAILY__.news || []).filter((n) => state.selectedIds.has(n.id));
          const txt = news.map((n) => `- ${n.title} ${n.url}`).join("\n");
          if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
          window.Insights && window.Insights.toast(`${ids.length}개 링크 복사됨`);
        }
        state.selectedIds.clear();
        updateMultiCount();
        renderNewsGrid();
      });
    });
  }

  function updateMultiCount() {
    setText("#multi-count", `${state.selectedIds.size}개 선택`);
  }

  // 저장된 뷰
  function renderSavedViews() {
    const root = $("#news-saved-views");
    if (!root) return;
    const views = (window.Storage && window.Storage.getViews()) || [];
    // 라벨 외 기존 자식 제거
    Array.from(root.children).forEach((c) => {
      if (!c.classList || !c.classList.contains("saved-views__label")) c.remove();
    });
    if (!views.length) {
      root.setAttribute("hidden", "");
    } else {
      root.removeAttribute("hidden");
      views.forEach((v) => {
        const pill = el("button", { className: "saved-view-pill", title: v.name },
          `📌 ${v.name}`,
          el("span", { className: "saved-view-pill__del", "aria-label": "삭제",
            onclick: (e) => {
              e.stopPropagation();
              window.Storage.removeView(v.id);
              renderSavedViews();
            },
          }, "✕")
        );
        pill.addEventListener("click", () => {
          if (v.filters) {
            state.categories = new Set(v.filters.categories || []);
            state.scoreMin = Number(v.filters.scoreMin || 0);
            state.search = v.filters.search || "";
            const slider = $("#news-score-min");
            if (slider) slider.value = String(state.scoreMin);
            const num = $("#news-score-num");
            if (num) num.textContent = state.scoreMin.toFixed(1);
            renderNewsGrid();
            // 칩 갱신
            $$("#news-categories .chip").forEach((b) => {
              const k = b.dataset.catKey;
              const active = (k === "__all" && state.categories.size === 0) ||
                (k !== "__all" && state.categories.has(k));
              b.setAttribute("data-active", active ? "true" : "false");
            });
          }
        });
        root.appendChild(pill);
      });
    }
  }

  // ───────────────────────────────────────────────────────
  // 7. 커뮤니티 탭
  // ───────────────────────────────────────────────────────
  const comState = {
    sources: new Set(),
    categories: new Set(),
    sort: "hot",
    search: "",
  };

  function setupCommunityTab() {
    const D = window.__DAILY__ || {};
    const items = D.community || [];

    // 소스 칩 (data에서 unique 수집)
    const srcRow = $("#community-sources");
    if (srcRow) {
      srcRow.innerHTML = "";
      const sources = uniqueBy(items, "source");
      srcRow.appendChild(chip("__all", "전체", () => { comState.sources.clear(); refreshSrc(); renderCommunityGrid(); }, true));
      sources.forEach((s) => {
        const sample = items.find((i) => i.source === s);
        srcRow.appendChild(chip(s, `${dotColor(sample.sourceColor)} ${sample.sourceLabel || s}`, () => {
          if (comState.sources.has(s)) comState.sources.delete(s);
          else comState.sources.add(s);
          refreshSrc(); renderCommunityGrid();
        }));
      });
      function refreshSrc() {
        $$("#community-sources .chip").forEach((b) => {
          const k = b.dataset.key;
          const active = (k === "__all" && comState.sources.size === 0) ||
            (k !== "__all" && comState.sources.has(k));
          b.setAttribute("data-active", active ? "true" : "false");
        });
      }
    }

    // 카테고리 칩
    const catRow = $("#community-categories");
    if (catRow) {
      catRow.innerHTML = "";
      catRow.appendChild(chip("__all", "전체", () => { comState.categories.clear(); refreshCat(); renderCommunityGrid(); }, true));
      CATEGORIES.forEach((c) => {
        catRow.appendChild(chip(c.key, `${c.icon} ${c.label}`, () => {
          if (comState.categories.has(c.key)) comState.categories.delete(c.key);
          else comState.categories.add(c.key);
          refreshCat(); renderCommunityGrid();
        }));
      });
      function refreshCat() {
        $$("#community-categories .chip").forEach((b) => {
          const k = b.dataset.key;
          const active = (k === "__all" && comState.categories.size === 0) ||
            (k !== "__all" && comState.categories.has(k));
          b.setAttribute("data-active", active ? "true" : "false");
        });
      }
    }

    // 정렬
    $$("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        comState.sort = btn.dataset.sort;
        $$("[data-sort]").forEach((b) => b.setAttribute("data-active",
          b.dataset.sort === comState.sort ? "true" : "false"));
        renderCommunityGrid();
      });
    });

    // 검색
    const tab = $('.tab-content[data-tab="community"]');
    if (tab) {
      const input = $("input[data-search-input]", tab);
      const clear = $("[data-search-clear]", tab);
      if (input) {
        const onSearch = debounce(() => {
          comState.search = (input.value || "").trim().toLowerCase();
          renderCommunityGrid();
        }, 150);
        input.addEventListener("input", onSearch);
      }
      if (clear) {
        clear.addEventListener("click", () => {
          if (input) input.value = "";
          comState.search = "";
          renderCommunityGrid();
        });
      }
    }

    renderCommunityGrid();
  }

  function renderCommunityGrid() {
    const grid = $("#community-grid");
    if (!grid) return;
    const all = (window.__DAILY__ && window.__DAILY__.community) || [];
    let list = all.filter((i) => {
      if (comState.sources.size && !comState.sources.has(i.source)) return false;
      if (comState.categories.size && !comState.categories.has(i.category)) return false;
      if (comState.search) {
        const hay = [i.title, i.author, i.sourceLabel].join(" ").toLowerCase();
        if (!hay.includes(comState.search)) return false;
      }
      return true;
    });
    if (comState.sort === "hot") list.sort((a, b) => (b.points || 0) - (a.points || 0));
    else list.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));

    setText("#community-counter", `${list.length}건 / 전체 ${all.length}`);
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("div", { className: "empty" }, "조건에 맞는 항목이 없습니다."));
      return;
    }
    list.forEach((c) => grid.appendChild(renderCommunityCard(c)));
  }

  function renderCommunityCard(c) {
    const cat = CATEGORY_BY_KEY[c.category];
    return el("article", {
      className: "card community-card",
      style: c.sourceColor ? `border-left-color:${c.sourceColor};` : "",
    },
      el("div", { className: "community-card__head" },
        el("span", {
          className: "community-card__src",
          style: c.sourceColor ? `color:${c.sourceColor};` : "",
        }, `● ${c.sourceLabel || c.source || ""}`),
        cat ? el("span", { className: "community-card__cat" }, `${cat.icon} ${cat.label}`) : null,
        el("span", { className: "community-card__time" }, c.relativeTime || fmtRelTime(c.postedAt))
      ),
      el("a", {
        className: "community-card__title",
        href: c.url, target: "_blank", rel: "noopener",
      }, c.title || ""),
      el("div", { className: "community-card__foot" },
        el("span", { className: "community-card__points" }, `${fmtNum(c.points)} pts`),
        c.author ? el("span", { className: "community-card__author" }, c.author) : null,
        el("a", {
          className: "community-card__link", href: c.url,
          target: "_blank", rel: "noopener",
        }, "원문 →")
      )
    );
  }

  // ───────────────────────────────────────────────────────
  // 8. 오픈소스 탭
  // ───────────────────────────────────────────────────────
  const ossState = { type: "all", search: "" };

  function setupOssTab() {
    const row = $("#oss-types");
    if (row) {
      row.innerHTML = "";
      OSS_TYPES.forEach((t) => {
        row.appendChild(chip(t.key, t.label, () => {
          ossState.type = t.key;
          $$("#oss-types .chip").forEach((b) => b.setAttribute("data-active",
            b.dataset.key === ossState.type ? "true" : "false"));
          renderOssGrid();
        }, t.key === "all"));
      });
    }

    const tab = $('.tab-content[data-tab="oss"]');
    if (tab) {
      const input = $("input[data-search-input]", tab);
      const clear = $("[data-search-clear]", tab);
      if (input) {
        const onSearch = debounce(() => {
          ossState.search = (input.value || "").trim().toLowerCase();
          renderOssGrid();
        }, 150);
        input.addEventListener("input", onSearch);
      }
      if (clear) {
        clear.addEventListener("click", () => {
          if (input) input.value = "";
          ossState.search = "";
          renderOssGrid();
        });
      }
    }

    renderOssGrid();
  }

  function renderOssGrid() {
    const grid = $("#oss-grid");
    if (!grid) return;
    const all = (window.__DAILY__ && window.__DAILY__.oss) || [];
    let list = all.filter((o) => {
      const t = ossState.type;
      if (t === "trending" && !o.isTrending) return false;
      if (t === "korean"   && !o.isKorean)   return false;
      if (t !== "all" && t !== "trending" && t !== "korean" && o.type !== t) return false;
      if (ossState.search) {
        const hay = [o.name, o.description, o.language, o.license].join(" ").toLowerCase();
        if (!hay.includes(ossState.search)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (a.isTrending !== b.isTrending) return a.isTrending ? -1 : 1;
      return (b.starsThisWeek || 0) - (a.starsThisWeek || 0);
    });

    setText("#oss-counter", `${list.length}건 / 전체 ${all.length}`);
    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("div", { className: "empty" }, "조건에 맞는 저장소가 없습니다."));
      return;
    }
    list.forEach((o) => grid.appendChild(renderOssCard(o)));
  }

  function renderOssCard(o) {
    return el("article", { className: "card oss-card" },
      el("div", { className: "oss-card__head" },
        el("span", { className: "oss-card__type" }, `${o.typeIcon || "📦"} ${o.typeLabel || o.type || ""}`),
        o.isKorean   ? el("span", { className: "oss-card__badge oss-card__badge--korean"   }, "🇰🇷 한국") : null,
        o.isTrending ? el("span", { className: "oss-card__badge oss-card__badge--trending" }, "🔥 trending") : null
      ),
      el("a", {
        className: "oss-card__name",
        href: o.url, target: "_blank", rel: "noopener",
      }, o.name || ""),
      el("p", { className: "oss-card__desc" }, o.description || ""),
      el("div", { className: "oss-card__meta" },
        el("span", null, `⭐ ${fmtNum(o.stars)}`),
        el("span", { className: "oss-card__delta" }, `+${fmtNum(o.starsThisWeek)}`),
        o.language ? el("span", null, o.language) : null,
        o.license  ? el("span", null, o.license) : null,
        o.contributors ? el("span", null, `${o.contributors} contrib`) : null
      ),
      o.note ? el("div", { className: "oss-card__note" }, `📝 ${o.note}`) : null,
      el("a", {
        className: "oss-card__link",
        href: o.url, target: "_blank", rel: "noopener",
      }, "GitHub →")
    );
  }

  // ───────────────────────────────────────────────────────
  // 9. 헤더 / 푸터 액션
  // ───────────────────────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function setupHeaderActions() {
    // theme
    applyTheme(window.Storage ? window.Storage.getTheme() : "light");
    const tt = $("#theme-toggle");
    if (tt) tt.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      const next = cur === "light" ? "dark" : "light";
      applyTheme(next);
      window.Storage && window.Storage.setTheme(next);
    });

    // gmail
    const gd = $("#gmail-draft");
    const gf = $("#footer-gmail");
    function gmailUrl() {
      const D = window.__DAILY__ || {};
      const subject = `Daily News · ${fmtKstNow()} · ${D.conclusion ? D.conclusion.headline : ""}`;
      const lines = [
        `5초 결론: ${D.conclusion ? D.conclusion.headline : ""}`,
        `종합: ${D.conclusion ? fmtScore(D.conclusion.scoreAvg) : "—"} (vs 7d ${D.conclusion ? D.conclusion.vs7d : "—"})`,
        "",
        "📋 5줄 요약:",
        ...((D.fiveLines || []).map((l, i) => `${i + 1}. ${l.text}`)),
        "",
        `뉴스 ${D.counts ? D.counts.news : 0}건 · OSS ${D.counts ? D.counts.oss : 0}건 · 인사이트 ${D.counts ? D.counts.insights : 0}건`,
      ].join("\n");
      const u = new URL("https://mail.google.com/mail/");
      u.searchParams.set("view", "cm");
      u.searchParams.set("fs", "1");
      u.searchParams.set("su", subject);
      u.searchParams.set("body", lines);
      return u.toString();
    }
    [gd, gf].forEach((btn) => {
      if (btn) btn.addEventListener("click", () => window.open(gmailUrl(), "_blank", "noopener"));
    });

    // 헤더 날짜
    setText("#header-date", `${fmtKstNow()} · 발행 시각 06:00 KST`);
    setText("#footer-generated", `생성 시각: ${fmtKstNow()}`);
  }

  // ───────────────────────────────────────────────────────
  // 10. 카드 점프 / 포커스
  // ───────────────────────────────────────────────────────
  function focusItem(id) {
    if (!id) return;
    switchTab("news");
    // 필터를 풀고 모두 보이게
    state.categories.clear();
    state.scoreMin = 0;
    state.search = "";
    const slider = $("#news-score-min");
    if (slider) slider.value = "0";
    const num = $("#news-score-num");
    if (num) num.textContent = "0.0";
    $$("#news-categories .chip").forEach((b) => b.setAttribute("data-active",
      b.dataset.catKey === "__all" ? "true" : "false"));
    renderNewsGrid();

    // 비동기 후 스크롤 + 하이라이트
    setTimeout(() => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("card--pulse");
        setTimeout(() => target.classList.remove("card--pulse"), 1800);
      }
    }, 30);
  }

  // ───────────────────────────────────────────────────────
  // 11. 보조
  // ───────────────────────────────────────────────────────
  function chip(key, label, onClick, isAll) {
    const b = el("button", {
      className: "chip", "data-key": key,
      "data-active": isAll ? "true" : "false",
    });
    b.innerHTML = "";
    if (typeof label === "string") b.textContent = label;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function dotColor(color) {
    return ""; // 색은 칩 자체에 inline-style로 줄 수도 있지만, 본 빌드에서는 미사용
  }

  function uniqueBy(arr, key) {
    const seen = new Set();
    const out = [];
    arr.forEach((x) => { if (!seen.has(x[key])) { seen.add(x[key]); out.push(x[key]); } });
    return out;
  }

  // ───────────────────────────────────────────────────────
  // 12. 부트
  // ───────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    try {
      renderHero();
      setupTabRouter();
      setupNewsTab();
      setupCommunityTab();
      setupOssTab();
      setupHeaderActions();
      if (window.Insights && typeof window.Insights.init === "function") {
        window.Insights.init();
      }
    } catch (err) {
      console.error("[Daily News] init failed:", err);
    }
  });

  // ───────────────────────────────────────────────────────
  // 13. 외부 노출
  // ───────────────────────────────────────────────────────
  window.App = {
    renderGauges,
    renderMiniGauges,
    switchTab,
    focusItem,
  };
})();
