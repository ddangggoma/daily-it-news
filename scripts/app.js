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
 * 의존:
 *   window.DN (util.js — 상수·헬퍼)
 *   window.__DAILY__, window.__EXPERTS__, window.__ARCHIVE__
 *   window.Storage, window.Insights
 */
(function () {
  "use strict";

  // ───────────────────────────────────────────────────────
  // 1. 공유 헬퍼 + 상수 (util.js)
  // ───────────────────────────────────────────────────────
  const {
    el, $, $$, escapeHtml,
    avgScore, scoreGrade, fmtScore, fmtNum, fmtRelTime, fmtKstNow,
    debounce, stars,
    CATEGORIES, CATEGORY_BY_KEY, COUNTRY_FLAG, GAUGES, OSS_TYPES,
  } = window.DN;

  // 🌏 Round 5: 한글 우선 표시 헬퍼.
  // translate.js 가 title_ko/summary_ko/description_ko 필드를 채워 두면 그것을 먼저 사용.
  // 캐시 미스/번역 실패로 _ko가 비어 있으면 원문(영어)을 fallback.
  // 사용자 요청 "모든 카드뉴스의 내용은 한글로 번역해줘"에 대응.
  function ko(item, field) {
    if (!item) return "";
    const koField = `${field}_ko`;
    if (item[koField] && typeof item[koField] === "string" && item[koField].trim()) {
      return item[koField];
    }
    return item[field] || "";
  }

  // ───────────────────────────────────────────────────────
  // 2. 게이지 렌더 (4기준 × 게이지)
  // ───────────────────────────────────────────────────────
  function renderGauges(scores, opts) {
    opts = opts || {};
    const wrap = el("div", { className: "gauges" + (opts.mini ? " gauges--mini" : "") });
    GAUGES.forEach((g) => {
      const v = Number(scores && scores[g.key] != null ? scores[g.key] : 0);
      const pct = Math.max(0, Math.min(100, (v / 5) * 100));
      // Iter 8 — Tufte: icon은 색·label 이중 redundant → label만 + 색.
      // (icon은 tooltip aria-label로 이동: 화면 정보 밀도 ↓, 의미 ≈ 동일)
      const node = el("div", {
          className: `gauge gauge--${g.key}`,
          title: `${g.icon} ${g.label} — ${g.tooltip || ""}`,
          role: "meter",
          "aria-label": `${g.label}: ${fmtScore(v)} / 5.0`,
          "aria-valuenow": String(v),
          "aria-valuemin": "0",
          "aria-valuemax": "5",
        },
        el("div", { className: "gauge__head" },
          el("span", { className: "gauge__label" }, g.label),
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

    // 헤드라인 카드 — 🌏 한글 번역 우선
    const headline = (D.news || []).find((n) => n.headline) || (D.news || [])[0];
    if (headline) {
      const link = $("#headline-title-link");
      if (link) { link.textContent = ko(headline, "title"); link.href = headline.url; link.target = "_blank"; link.rel = "noopener"; }
      setText("#headline-summary", ko(headline, "summary"));
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

    // 인플루언서 (daily-rotation으로 매일 다른 24명, 4×6 grid)
    renderInfluencers(D.influencers || []);

    // 오늘 떠오른 테마 + 기술 (today's news/community/oss text 기반 자동 추출)
    renderThemes();
    renderTechs();

    // Round 3: 7-day timeline (과거 발행으로 이동) + 데이터 플로우 시각화
    renderDayTimeline();
    renderFlowIndicator();
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
    // 사용자 피드백 ("너무 세로로만 나열"): horizontal-scrolling strip → grid 레이아웃.
    // 24명 (4×6) 표시 + "전체 N명 추적 중" 카운터.
    root.innerHTML = "";
    root.className = "influencer-grid"; // strip → grid 클래스 변경
    const D = window.__DAILY__ || {};
    const daily = (typeof window.__INFLUENCERS_DAILY__ === "function")
      ? window.__INFLUENCERS_DAILY__(D.date || new Date().toISOString().slice(0, 10))
      : null;
    const list = (daily && daily.length) ? daily : arr;
    const total = (typeof window.__INFLUENCERS_TOTAL__ === "function")
      ? window.__INFLUENCERS_TOTAL__() : list.length;

    // 헤더: "추적 중 인플루언서" + 전체 N명 + 매일 24명 rotation 안내
    root.appendChild(el("div", { className: "influencer-grid__head" },
      el("span", null, "👀 추적 중인 인플루언서"),
      el("span", { className: "influencer-grid__total" },
        `전체 ${total}명 · 오늘의 24명`)
    ));

    list.forEach((p) => {
      const tag = p.url ? "a" : "div";
      const attrs = {
        className: "influencer-card",
        "data-cat": p.category || "",
      };
      if (p.url) {
        attrs.href = p.url;
        attrs.target = "_blank";
        attrs.rel = "noopener";
        attrs["aria-label"] = `${p.name} (${p.role || ""}) ${p.handle ? "X " + p.handle : ""} 프로필 새 창`;
      }
      root.appendChild(el(tag, attrs,
        el("span", { className: "influencer-card__avatar" }, p.avatar || "👤"),
        el("div", { className: "influencer-card__body" },
          el("div", { className: "influencer-card__name" }, p.name || ""),
          el("div", { className: "influencer-card__role" }, p.role || p.handle || "")
        ),
        el("span", { className: "influencer-card__cat-dot", title: p.category || "" })
      ));
    });
  }

  // ── 과거 7일 timeline (Round 3) ────────────────────────
  // 사용자 요청 "전날 뉴스들도 볼 수 있도록 UX": 헤드에 7-day pill 스트립 추가.
  // 오늘 = 활성 / 어제 + N일 = archive.html 의 해당 날짜 stub로 이동.
  function renderDayTimeline() {
    const root = $("#day-timeline");
    if (!root) return;
    root.innerHTML = "";
    root.appendChild(el("div", { className: "day-timeline__head" }, "📅 최근 7일"));

    const archive = window.__ARCHIVE__ || [];
    const D = window.__DAILY__ || {};
    const todayDate = D.date || new Date().toISOString().slice(0, 10);
    // 오늘부터 6일 전까지 7개 pill. archive.js가 가진 항목 우선, 없으면 비활성.
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const arch = archive.find((a) => a.date === iso);
      days.push({ iso, dayLabel: ["일","월","화","수","목","금","토"][d.getDay()],
                  shortDate: iso.slice(5).replace("-", "/"),
                  hasData: !!arch || i === 0,
                  isToday: i === 0,
                  scoreAvg: arch ? arch.scoreAvg : (i === 0 && D.conclusion ? D.conclusion.scoreAvg : null) });
    }
    days.forEach((d) => {
      const tag = d.hasData ? "a" : "div";
      const attrs = {
        className: "day-pill",
        "data-active": d.isToday ? "true" : "false",
        "data-disabled": d.hasData ? "false" : "true",
        title: d.isToday ? "오늘 (지금 보고 있는 발행)" : `${d.iso} 발행 보기`,
      };
      if (d.hasData && !d.isToday) {
        attrs.href = `archive.html#archive-${d.iso}`;
        attrs["aria-label"] = `${d.iso} 발행 아카이브로 이동`;
      } else if (d.isToday) {
        attrs["aria-current"] = "page";
      }
      root.appendChild(el(tag, attrs,
        el("span", { className: "day-pill__date" }, d.shortDate),
        el("span", { className: "day-pill__day" }, d.dayLabel),
        d.scoreAvg != null ? el("span", { className: "day-pill__score" }, fmtScore(d.scoreAvg)) : null
      ));
    });
  }

  // ── 데이터 플로우 시각화 (Round 3) ─────────────────────
  // 사용자 요청 "전체적인 플로우가 보일 수 있도록": 6단계 파이프라인 표시.
  function renderFlowIndicator() {
    const root = $("#flow-indicator");
    if (!root) return;
    root.innerHTML = "";
    const D = window.__DAILY__ || {};
    const counts = D.counts || {};
    const stats = D.stats || {};
    const steps = [
      { icon: "📡", label: "수집", value: `${(counts.news || 0) + (counts.community || 0) + (counts.oss || 0)}건` },
      { icon: "🎯", label: "IT 필터", value: `relevance ≥ 0.6` },
      { icon: "📊", label: "4기준 채점", value: `${stats.score45plus || 0}건 4.5+` },
      { icon: "📰", label: "뉴스 분류", value: `${counts.news || 0}건 / ${stats.categoriesActive || 0} cat` },
      { icon: "🧠", label: "20인 분석", value: `${counts.insights || 0}개 인사이트` },
      { icon: "📤", label: "발행", value: `RSS · 아카이브` },
    ];
    steps.forEach((s, i) => {
      root.appendChild(el("div", { className: "flow-indicator__step" },
        el("span", null, s.icon), " ",
        el("strong", null, s.label), " ",
        el("span", null, s.value)
      ));
      if (i < steps.length - 1) {
        root.appendChild(el("span", { className: "flow-indicator__arrow", "aria-hidden": "true" }, "→"));
      }
    });
  }

  // ── 오늘의 테마 / 기술 strip ───────────────────────────
  function collectAllText() {
    const D = window.__DAILY__ || {};
    const buckets = [D.news || [], D.community || [], D.oss || []];
    const out = [];
    buckets.forEach((arr) => arr.forEach((it) => {
      out.push(`${it.title || ""} ${it.summary || it.description || ""} ${(it.tags || []).join(" ")}`);
    }));
    return out;
  }

  function renderThemes() {
    const root = $("#theme-strip");
    if (!root || typeof window.__THEME_MATCH__ !== "function") return;
    const all = collectAllText();
    if (!all.length) return;
    // 빈도 카운트
    const counts = {};
    all.forEach((text) => {
      window.__THEME_MATCH__(text).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    });
    const themes = (window.__THEMES__ || [])
      .filter((t) => counts[t.id])
      .sort((a, b) => counts[b.id] - counts[a.id])
      .slice(0, 8);
    if (!themes.length) return;
    root.innerHTML = "";
    root.appendChild(el("div", { className: "theme-strip__head" }, "🔥 오늘 떠오른 테마"));
    themes.forEach((t) => {
      const chip = el("button", {
        className: "theme-chip",
        type: "button",
        title: `검색 적용: ${t.label}`,
        "aria-label": `테마 ${t.label} 검색`,
        onclick: () => triggerNewsSearch(t.label),
      },
        el("span", null, `${t.icon || "•"} ${t.label}`),
        el("span", { className: "tech-chip__count" }, `${counts[t.id]}건`)
      );
      root.appendChild(chip);
    });
  }

  function renderTechs() {
    const root = $("#tech-strip");
    if (!root || typeof window.__TECH_MATCH__ !== "function") return;
    const all = collectAllText();
    if (!all.length) return;
    const counts = {};
    all.forEach((text) => {
      window.__TECH_MATCH__(text).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    });
    const techs = (window.__TECHS__ || [])
      .filter((t) => counts[t.id])
      .sort((a, b) => counts[b.id] - counts[a.id])
      .slice(0, 12);
    if (!techs.length) return;
    root.innerHTML = "";
    root.appendChild(el("div", { className: "tech-strip__head" }, "🛠 오늘 언급된 기술"));
    techs.forEach((t) => {
      // Iter 10 — Victor: 두 동작이 한 칩에 묶여 있어 모호. 외부링크는 ↗(CSS pseudo)로
      // 명시. 클릭은 항상 외부 새 창으로 가되, background 로 검색도 적용 (UX 둘 다 만족).
      // 보조키(Cmd/Ctrl)면 외부로만, Shift면 검색만 — power user 단축키.
      const chip = el("a", {
        className: "tech-chip",
        href: t.url || "#",
        target: t.url ? "_blank" : "_self",
        rel: "noopener",
        title: `${t.label} 공식 사이트로 이동 (Shift+클릭: 이 사이트 안에서 검색만)`,
        "aria-label": `${t.label} 공식 사이트 새 창에서 열기, ${counts[t.id]}건 매칭`,
        onclick: (e) => {
          if (!t.url) { e.preventDefault(); triggerNewsSearch(t.label); return; }
          if (e.shiftKey) { e.preventDefault(); triggerNewsSearch(t.label); return; }
          // 일반 클릭: 외부 + 검색 동시
          triggerNewsSearch(t.label);
        },
      },
        el("span", null, `${t.icon || "•"} ${t.label}`),
        el("span", { className: "tech-chip__count" }, `${counts[t.id]}건`)
      );
      root.appendChild(chip);
    });
  }

  function triggerNewsSearch(query) {
    switchTab("news");
    state.search = String(query || "").trim().toLowerCase();
    state.categories.clear();
    state.scoreMin = 0;
    const slider = $("#news-score-min"); if (slider) slider.value = "0";
    const num = $("#news-score-num"); if (num) num.textContent = "0.0";
    const input = $('#news-search input[data-search-input]');
    if (input) input.value = query;
    $$("#news-categories .chip").forEach((b) => b.setAttribute("data-active",
      b.dataset.catKey === "__all" ? "true" : "false"));
    renderNewsGrid();
    // 부드럽게 그리드로 스크롤
    const grid = $("#news-grid");
    if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function filterByCategory(catKey) {
    if (!catKey) return;
    switchTab("news");
    state.categories = new Set([catKey]);
    state.search = "";
    const input = $('#news-search input[data-search-input]'); if (input) input.value = "";
    $$("#news-categories .chip").forEach((b) => b.setAttribute("data-active",
      b.dataset.catKey === catKey ? "true" : "false"));
    renderNewsGrid();
    const grid = $("#news-grid");
    if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setText(sel, v) {
    const n = $(sel);
    if (n) n.textContent = v == null ? "" : String(v);
  }

  // ───────────────────────────────────────────────────────
  // 5. 탭 라우터
  // ───────────────────────────────────────────────────────
  function setupTabRouter() {
    const btns = $$(".tab-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      // Iter 9 — 키보드 화살표로 탭 이동 (ARIA Authoring Practices: Tab Pattern)
      btn.addEventListener("keydown", (e) => {
        const idx = btns.indexOf(btn);
        let next = -1;
        if (e.key === "ArrowRight") next = (idx + 1) % btns.length;
        else if (e.key === "ArrowLeft") next = (idx - 1 + btns.length) % btns.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = btns.length - 1;
        if (next !== -1) {
          e.preventDefault();
          btns[next].focus();
          switchTab(btns[next].dataset.tab);
        }
      });
    });
    // 카운터 채움
    const c = (window.__DAILY__ && window.__DAILY__.counts) || {};
    setText("#count-news", c.news != null ? c.news : "—");
    setText("#count-community", c.community != null ? c.community : "—");
    setText("#count-oss", c.oss != null ? c.oss : "—");
    setText("#count-research", c.research != null ? c.research : "—");
    setText("#count-insights", c.insights != null ? c.insights : "—");
  }

  function switchTab(tab) {
    // Iter 9 — 탭 ARIA: aria-selected + tabindex (roving tab index)
    $$(".tab-btn").forEach((b) => {
      const active = b.dataset.tab === tab;
      b.setAttribute("data-active", active ? "true" : "false");
      b.setAttribute("aria-selected", active ? "true" : "false");
      b.setAttribute("tabindex", active ? "0" : "-1");
    });
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
    sort: "score", // Round 6: 정렬 옵션 (score / recent / impact / freshness)
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
      // Round 5: papers/standards는 별도 "논문·특허·표준" 탭으로 이동 → 뉴스 칩에서 제거.
      const NEWS_TAB_HIDDEN = new Set(["papers", "standards"]);
      CATEGORIES.filter((c) => !NEWS_TAB_HIDDEN.has(c.key)).forEach((c) => {
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

    // 점수 슬라이더 — 라벨은 즉시 갱신, grid 재렌더는 debounce 50ms.
    // Iter 6 (Norman): aria-valuetext로 의미 명확화. min/max는 CSS pseudo로 표시.
    // Iter 10 (Victor): counter는 즉시 갱신 (debounce 없이) — 사용자가 슬라이드 중
    //   "지금 몇 건 매칭"을 즉시 본다.
    const slider = $("#news-score-min");
    const num = $("#news-score-num");
    if (slider && num) {
      slider.value = "0";
      num.textContent = "0.0";
      slider.setAttribute("aria-label", "최소 점수 필터");
      slider.setAttribute("aria-valuetext", "0.0 — 모두 표시");
      const debouncedRender = debounce(() => renderNewsGrid(), 50);
      slider.addEventListener("input", () => {
        state.scoreMin = parseFloat(slider.value) || 0;
        num.textContent = state.scoreMin.toFixed(1);
        slider.setAttribute("aria-valuetext",
          state.scoreMin === 0 ? "0.0 — 모두 표시" : `${state.scoreMin.toFixed(1)} 이상만`);
        // Iter 10 — instant counter (debounce 없이 N건 표시. grid rebuild는 debounced)
        const all = (window.__DAILY__ && window.__DAILY__.news) || [];
        const matched = filterNews(all).length;
        setText("#news-counter", `${matched}건 / 전체 ${all.length}`);
        debouncedRender();
      });
    }

    // 검색 — Iter 10: 카운터는 즉시, grid rebuild만 debounce
    const searchWrap = $("#news-search");
    if (searchWrap) {
      const input = $("input[data-search-input]", searchWrap);
      const clear = $("[data-search-clear]", searchWrap);
      if (input) {
        const debouncedRender = debounce(() => renderNewsGrid(), 150);
        input.addEventListener("input", () => {
          state.search = (input.value || "").trim().toLowerCase();
          // 즉시: counter 만 갱신 (사용자가 입력 중 N건 보임)
          const all = (window.__DAILY__ && window.__DAILY__.news) || [];
          const matched = filterNews(all).length;
          setText("#news-counter", `${matched}건 / 전체 ${all.length}`);
          // 지연: 실제 grid rebuild (DOM 비싸므로)
          debouncedRender();
          // data-has-value 토글 (clear 버튼 visibility)
          searchWrap.setAttribute("data-has-value", input.value ? "true" : "false");
        });
      }
      if (clear) {
        clear.addEventListener("click", () => {
          if (input) { input.value = ""; }
          state.search = "";
          searchWrap.setAttribute("data-has-value", "false");
          renderNewsGrid();
        });
      }
    }

    // 🔄 Round 6: 정렬 셀렉터
    const sortSel = $("#news-sort");
    if (sortSel) {
      sortSel.value = state.sort;
      sortSel.addEventListener("change", () => {
        state.sort = sortSel.value;
        renderNewsGrid();
      });
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

  // PERF Round 4 (Expert 5 Souders + Expert 8 Caswell):
  // 매 키스트로크마다 322 items × (Array.join + toLowerCase + spread) → 322개 transient 문자열.
  // boot 시 1회 pre-compute → filter는 string indexOf만 (O(1)).
  // avgScore도 캐시 — 이전엔 sort comparator에서 N log N × 4 fields = 호출 폭주.
  function buildNewsIndex() {
    const news = (window.__DAILY__ && window.__DAILY__.news) || [];
    for (let i = 0; i < news.length; i++) {
      const n = news[i];
      if (n.__indexed) continue;
      n.__hay = `${n.title || ""} ${n.summary || ""} ${n.source || ""} ${n.sourceCountry || ""} ${(n.tags || []).join(" ")}`.toLowerCase();
      const s = n.scores || {};
      n.__avg = ((+s.impact || 0) + (+s.freshness || 0) + (+s.depth || 0) + (+s.buzz || 0)) / 4;
      n.__indexed = true;
    }
  }

  function filterNews(items) {
    const q = state.search;
    const sm = state.scoreMin;
    const cats = state.categories;
    const hasCats = cats.size > 0;
    const qLen = q ? q.length : 0;
    const arr = items || [];
    const out = [];
    // 핫 루프 — branch-predictable, 0 allocations.
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      if (hasCats && !cats.has(n.category)) continue;
      if (sm > 0 && (n.__avg != null ? n.__avg : avgScore(n.scores)) < sm) continue;
      if (qLen) {
        const hay = n.__hay != null ? n.__hay : (
          `${n.title || ""} ${n.summary || ""} ${n.source || ""} ${(n.tags || []).join(" ")}`.toLowerCase()
        );
        if (hay.indexOf(q) === -1) continue;
      }
      out.push(n);
    }
    return out;
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

  // 🔄 Round 6: 정렬 함수 (뉴스/논문 공통). 사용자 요청 "정렬 가능하도록".
  // - score: 종합 점수 (default)
  // - recent: 최신순 (publishedAt)
  // - impact: 파급력만
  // - buzz: 반응도(커뮤니티 신호)
  // - freshness: 시의성
  function sortByMode(items, mode) {
    const sorted = [...items];
    if (mode === "recent") {
      sorted.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
    } else if (mode === "impact") {
      sorted.sort((a, b) => (b.scores?.impact || 0) - (a.scores?.impact || 0));
    } else if (mode === "buzz") {
      sorted.sort((a, b) => (b.scores?.buzz || 0) - (a.scores?.buzz || 0));
    } else if (mode === "freshness") {
      sorted.sort((a, b) => (b.scores?.freshness || 0) - (a.scores?.freshness || 0));
    } else { // "score" default
      sorted.sort((a, b) => (b.__avg != null ? b.__avg : avgScore(b.scores)) -
                            (a.__avg != null ? a.__avg : avgScore(a.scores)));
    }
    return sorted;
  }

  function renderNewsGrid() {
    const grid = $("#news-grid");
    if (!grid) return;
    grid.setAttribute("aria-busy", "false");

    const all = (window.__DAILY__ && window.__DAILY__.news) || [];
    const filtered = filterNews(all);
    // 🔄 Round 6: 정렬 적용
    const list = sortByMode(filtered, state.sort);

    setText("#news-counter", `${list.length}건 / 전체 ${all.length}`);
    renderBreadcrumb();

    if (!list.length) {
      const reset = el("button", {
        className: "empty__action",
        type: "button",
        onclick: () => {
          state.categories.clear();
          state.scoreMin = 0;
          state.search = "";
          const slider = $("#news-score-min"); if (slider) slider.value = "0";
          const num = $("#news-score-num"); if (num) num.textContent = "0.0";
          const input = $('#news-search input[data-search-input]'); if (input) input.value = "";
          $$("#news-categories .chip").forEach((b) => b.setAttribute("data-active",
            b.dataset.catKey === "__all" ? "true" : "false"));
          renderNewsGrid();
        },
      }, "↺ 모든 필터 해제");
      // PERF Round 4 (Souders): innerHTML="" + appendChild = 2 reflow. replaceChildren = 1 reflow.
      grid.replaceChildren(el("div", { className: "empty" },
        el("div", { className: "empty__icon" }, "🔭"),
        el("div", { className: "empty__title" }, "이 조건에 맞는 뉴스가 없네요"),
        el("div", { className: "empty__text" }, "필터를 살짝 풀어 보거나, 다른 카테고리를 둘러보세요."),
        reset
      ));
      return;
    }

    const flagSets = {
      starred:    new Set(window.Storage ? window.Storage.getFlagged("starred")   : []),
      bookmarks:  new Set(window.Storage ? window.Storage.getFlagged("bookmarks") : []),
      read:       new Set(window.Storage ? window.Storage.getFlagged("read")      : []),
    };

    // PERF Round 4 (Souders P2): innerHTML="" → appendChild 2단계 reflow를
    // replaceChildren 1단계로 통합. 322 카드 chip-toggle 시 ~10-15% 절감.
    const frag = document.createDocumentFragment();
    list.forEach((n) => frag.appendChild(renderNewsCard(n, flagSets)));
    grid.replaceChildren(frag);
  }

  function renderNewsCard(n, flagSets) {
    const cat = CATEGORY_BY_KEY[n.category] || { icon: "📰", label: n.category };
    const score = avgScore(n.scores);
    const grade = scoreGrade(score);

    const card = el("article", {
      className: "card" + (n.featured ? " card--featured" : ""),
      id: n.id, "data-id": n.id,
      // Iter 9 — semantic ARIA: 카드는 article + aria-labelledby로 제목 인식
      "aria-labelledby": `${n.id}-title`,
      tabindex: "0",
    });

    // head: 카테고리·소스·시각 + 점수 배지 — 메타 클릭 시 자동 필터.
    const head = el("div", { className: "card__head" },
      el("div", { className: "card__meta" },
        el("span", {
          className: "card__cat",
          role: "button", tabindex: "0", style: "cursor:pointer",
          title: `이 카테고리로 필터: ${cat.label}`,
          onclick: (e) => { e.stopPropagation(); filterByCategory(n.category); },
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filterByCategory(n.category); } },
        }, `${cat.icon} ${cat.label}`),
        el("span", {
          className: "card__src",
          role: "button", tabindex: "0", style: "cursor:pointer",
          title: `이 소스로 검색: ${n.source || ""}`,
          onclick: (e) => { e.stopPropagation(); triggerNewsSearch(n.source || ""); },
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); triggerNewsSearch(n.source || ""); } },
        }, `${COUNTRY_FLAG[n.sourceCountry] || ""} ${n.source || ""}`),
        el("span", { className: "card__time" }, fmtRelTime(n.publishedAt))
      ),
      el("div", {
          className: `card__score-badge card__score-badge--g${grade}`,
          "data-grade": String(grade), // Iter 7 — CSS [data-grade="N"] selector 호환
          "aria-label": `종합 점수 ${fmtScore(score)} / 5.0 (등급 ${grade})`,
        },
        el("span", { className: "card__score-num" }, fmtScore(score)),
        el("span", { className: "card__score-stars" }, stars(score))
      )
    );

    // body: 제목 + 요약 — 🌏 Round 5: 한글 번역 우선 (title_ko/summary_ko fallback to 원문)
    const titleLink = el("a", {
      className: "card__title",
      href: n.url, target: "_blank", rel: "noopener",
      id: `${n.id}-title`,
    }, ko(n, "title"));
    const body = el("div", { className: "card__body" },
      titleLink,
      el("p", { className: "card__summary" }, ko(n, "summary"))
    );

    // 4 게이지
    const gauges = renderGauges(n.scores || {});

    // 태그
    const tags = el("div", { className: "card__tags" });
    (n.tags || []).forEach((t) => {
      tags.appendChild(el("span", { className: "card__tag" }, `#${t}`));
    });

    // foot: 액션 — Set.has()로 O(1), localStorage 호출 0회 (renderNewsGrid에서 1회만 읽음)
    const sets = flagSets || { starred: new Set(), bookmarks: new Set(), read: new Set() };
    const isStarred = sets.starred.has(n.id);
    const isBkmk    = sets.bookmarks.has(n.id);
    const isRead    = sets.read.has(n.id);
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
      "aria-label": "별표",
      "aria-pressed": isStarred ? "true" : "false",
      title: "별표",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("starred", n.id);
        actStar.setAttribute("data-on", on ? "true" : "false");
        actStar.setAttribute("aria-pressed", on ? "true" : "false");
      },
    }, "⭐");
    const actBkmk = el("button", {
      className: "card__act",
      "data-on": isBkmk ? "true" : "false",
      "aria-label": "나중에 읽기 북마크",
      "aria-pressed": isBkmk ? "true" : "false",
      title: "나중에 읽기",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("bookmarks", n.id);
        actBkmk.setAttribute("data-on", on ? "true" : "false");
        actBkmk.setAttribute("aria-pressed", on ? "true" : "false");
      },
    }, "🔖");
    const actRead = el("button", {
      className: "card__act",
      "data-on": isRead ? "true" : "false",
      "aria-label": "읽음 처리",
      "aria-pressed": isRead ? "true" : "false",
      title: "읽음 처리",
      onclick: (e) => {
        e.stopPropagation();
        const on = window.Storage.toggleFlag("read", n.id);
        actRead.setAttribute("data-on", on ? "true" : "false");
        actRead.setAttribute("aria-pressed", on ? "true" : "false");
        card.classList.toggle("card--read", on);
      },
    }, "✅");
    const actLink = el("a", {
      className: "card__act card__act--link",
      href: n.url, target: "_blank", rel: "noopener",
      "aria-label": `${n.title} 원문 새 창에서 열기`,
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
        srcRow.appendChild(chip(s, sample.sourceLabel || s, () => {
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
    // 🔄 Round 6: 정렬 옵션 확장 (hot/recent + 신규 viral/sns_first)
    if (comState.sort === "hot") {
      list.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else if (comState.sort === "viral") {
      // 1000+ pts만 우선, 그 안에서 시간순
      list.sort((a, b) => {
        const va = (a.points || 0) >= 1000 ? 1 : 0;
        const vb = (b.points || 0) >= 1000 ? 1 : 0;
        if (va !== vb) return vb - va;
        return Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0);
      });
    } else if (comState.sort === "sns") {
      // SNS (Mastodon/X) 글 우선
      list.sort((a, b) => {
        const sa = isSnsSource(a.source) ? 1 : 0;
        const sb = isSnsSource(b.source) ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0);
      });
    } else {
      list.sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));
    }

    setText("#community-counter", `${list.length}건 / 전체 ${all.length}`);
    grid.setAttribute("aria-busy", "false");
    if (!list.length) {
      grid.replaceChildren(el("div", { className: "empty" },
        el("div", { className: "empty__icon" }, "💬"),
        el("div", { className: "empty__title" }, "이 조건의 토론을 못 찾았어요"),
        el("div", { className: "empty__text" }, "소스나 카테고리를 다르게 골라 보세요.")
      ));
      return;
    }
    // PERF Round 4 (Souders): replaceChildren = 1 reflow vs innerHTML+append = 2.
    const frag = document.createDocumentFragment();
    list.forEach((c) => frag.appendChild(renderCommunityCard(c)));
    grid.replaceChildren(frag);
  }

  // 💬 Round 6: 커뮤니티 카드 재디자인 (사용자 피드백:
  //   "커뮤니티 카드들은 번역이 되지 않았고, 카드 들의 중요도 파악이 힘듭니다.
  //    검토해서 중요도 관련 수치들을 잘보이도록 추가해주세요").
  // 변경사항:
  //   1) 한글 ko() 적용 (이미 있던 것 유지)
  //   2) 중요도 시그널 명확히: points + 댓글수 + 시간 + 점수 등급 배지
  //   3) SNS (Mastodon/X) 글은 "💬 SNS" 시그널 prefix
  //   4) 등급 배지 (🔥/⭐/👀/💭) — points 기준
  function communityImportance(points) {
    if (!points || points < 1) return { tier: "low", icon: "💭", label: "최신" };
    if (points >= 1000) return { tier: "viral", icon: "🔥", label: "Viral" };
    if (points >= 500)  return { tier: "hot",   icon: "⭐", label: "인기" };
    if (points >= 100)  return { tier: "rising",icon: "📈", label: "주목" };
    if (points >= 30)   return { tier: "warm",  icon: "👀", label: "관심" };
    return { tier: "low", icon: "💭", label: "최신" };
  }

  function isSnsSource(source) {
    return /^(mastodon_|fosstodon_|x_|yt_)/.test(source || "");
  }

  function renderCommunityCard(c) {
    const cat = CATEGORY_BY_KEY[c.category];
    const importance = communityImportance(c.points);
    const sns = isSnsSource(c.source);
    const cardClass = `card community-card community-card--${importance.tier}` + (sns ? " community-card--sns" : "");
    const time = c.relativeTime || fmtRelTime(c.postedAt);

    return el("article", {
      className: cardClass,
      style: c.sourceColor ? `border-left-color:${c.sourceColor};` : "",
      "data-id": c.id,
    },
      // 1단: head — 출처 + 카테고리 + 시간 + 중요도 배지
      el("div", { className: "community-card__head" },
        el("span", {
          className: "community-card__src",
          style: c.sourceColor ? `color:${c.sourceColor};` : "",
        }, `● ${c.sourceLabel || c.source || ""}`),
        sns ? el("span", { className: "community-card__sns-badge" }, "💬 SNS") : null,
        cat ? el("span", { className: "community-card__cat" }, `${cat.icon} ${cat.label}`) : null,
        el("span", { className: "community-card__time" }, time)
      ),
      // 2단: 제목 (ko 한글 우선)
      el("a", {
        className: "community-card__title",
        href: c.url, target: "_blank", rel: "noopener",
      }, ko(c, "title")),
      // 3단: 중요도 표시 — points 큰 글자 + 등급 배지 + 작성자 + 원문 (SNS는 description 일부 표시)
      sns && c.summary_ko ? el("p", { className: "community-card__excerpt" },
        ko(c, "summary").slice(0, 120) + (ko(c, "summary").length > 120 ? "…" : "")
      ) : null,
      el("div", { className: "community-card__foot" },
        el("span", { className: `community-card__importance community-card__importance--${importance.tier}` },
          `${importance.icon} ${importance.label}`
        ),
        c.points >= 1 ? el("span", { className: "community-card__points" },
          el("strong", null, fmtNum(c.points)),
          el("span", { className: "community-card__points-label" }, sns ? "engage" : "pts")
        ) : null,
        c.author ? el("span", { className: "community-card__author" }, `@${c.author}`) : null,
        el("a", {
          className: "community-card__link", href: c.url,
          target: "_blank", rel: "noopener",
        }, "원문 ↗")
      )
    );
  }

  // ───────────────────────────────────────────────────────
  // 8. 오픈소스 탭
  // ───────────────────────────────────────────────────────
  const ossState = { type: "all", search: "", sort: "trending" }; // 🔄 Round 6: sort 추가

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

    // 🔄 Round 6: OSS 정렬 chip
    $$("[data-oss-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ossState.sort = btn.dataset.ossSort;
        $$("[data-oss-sort]").forEach((b) => b.setAttribute("data-active",
          b.dataset.ossSort === ossState.sort ? "true" : "false"));
        renderOssGrid();
      });
    });

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
    // 🔄 Round 6: 정렬 모드 (trending / stars / growth / recent)
    if (ossState.sort === "stars") {
      list.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    } else if (ossState.sort === "growth") {
      list.sort((a, b) => (b.starsThisWeek || 0) - (a.starsThisWeek || 0));
    } else if (ossState.sort === "recent") {
      list.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
    } else {
      // trending (default): trending 우선, 그 안에서 이번주 별 증가순
      list.sort((a, b) => {
        if (a.isTrending !== b.isTrending) return a.isTrending ? -1 : 1;
        return (b.starsThisWeek || 0) - (a.starsThisWeek || 0);
      });
    }

    setText("#oss-counter", `${list.length}건 / 전체 ${all.length}`);
    grid.setAttribute("aria-busy", "false");
    if (!list.length) {
      grid.replaceChildren(el("div", { className: "empty" },
        el("div", { className: "empty__icon" }, "📦"),
        el("div", { className: "empty__title" }, "조건에 맞는 저장소가 없어요"),
        el("div", { className: "empty__text" }, "타입 필터를 풀거나 검색어를 줄여 보세요.")
      ));
      return;
    }
    // PERF Round 4: replaceChildren single reflow.
    const frag = document.createDocumentFragment();
    list.forEach((o) => frag.appendChild(renderOssCard(o)));
    grid.replaceChildren(frag);
  }

  // ───────────────────────────────────────────────────────
  // 8.5. 논문·특허·표준 탭 (Round 5 신규)
  // ───────────────────────────────────────────────────────
  // 사용자 요청: "논문, 특허/표준은 뉴스, 커뮤니티, 오픈소스, '논문/특허/표준' 레벨의 탭으로 옮기고
  //  관련된 내용들의 레벨을 모두 옮겨서 필터나 검색이 정상적으로 되도록".
  // build-today.js가 papers/standards 카테고리를 research[]로 분리. 이 탭은 그것만 표시.
  const researchState = { type: "all", search: "" };
  // 🆕 Round 9: 논문·특허·표준 세부 필터 (논문은 분야별 sub-filter도 추가).
  const RESEARCH_TYPES = [
    { key: "all",       label: "전체" },
    { key: "papers",    label: "📄 논문" },
    { key: "standards", label: "⚖️ 특허·표준" },
    // 논문 sub-filter: arxiv 카테고리별 (CS.AI / CS.LG / CS.CL)
    { key: "arxiv_ai",  label: "🤖 arXiv AI" },
    { key: "arxiv_ml",  label: "🧠 arXiv ML" },
    { key: "arxiv_nlp", label: "💬 arXiv NLP" },
  ];

  function setupResearchTab() {
    const row = $("#research-types");
    if (row) {
      row.innerHTML = "";
      RESEARCH_TYPES.forEach((t) => {
        row.appendChild(chip(t.key, t.label, () => {
          researchState.type = t.key;
          $$("#research-types .chip").forEach((b) => b.setAttribute("data-active",
            b.dataset.key === researchState.type ? "true" : "false"));
          renderResearchGrid();
        }, t.key === "all"));
      });
    }
    const tab = $('.tab-content[data-tab="research"]');
    if (tab) {
      const input = $("input[data-search-input]", tab);
      const clear = $("[data-search-clear]", tab);
      if (input) {
        const onSearch = debounce(() => {
          researchState.search = (input.value || "").trim().toLowerCase();
          renderResearchGrid();
        }, 150);
        input.addEventListener("input", onSearch);
      }
      if (clear) {
        clear.addEventListener("click", () => {
          if (input) input.value = "";
          researchState.search = "";
          renderResearchGrid();
        });
      }
    }
    renderResearchGrid();
  }

  function renderResearchGrid() {
    const grid = $("#research-grid");
    if (!grid) return;
    const all = (window.__DAILY__ && window.__DAILY__.research) || [];
    const list = all.filter((r) => {
      // 🆕 Round 9: arxiv sub-filter (cs.AI / cs.LG / cs.CL 별)
      if (researchState.type === "arxiv_ai") return r.source === "arxiv_cs_ai";
      if (researchState.type === "arxiv_ml") return r.source === "arxiv_cs_lg";
      if (researchState.type === "arxiv_nlp") return r.source === "arxiv_cs_cl";
      if (researchState.type !== "all" && r.category !== researchState.type) return false;
      if (researchState.search) {
        const hay = `${r.title || ""} ${r.summary || ""} ${r.author || ""} ${(r.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(researchState.search)) return false;
      }
      return true;
    }).sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));

    setText("#research-counter", `${list.length}건 / 전체 ${all.length}`);
    grid.setAttribute("aria-busy", "false");
    if (!list.length) {
      grid.replaceChildren(el("div", { className: "empty" },
        el("div", { className: "empty__icon" }, "📜"),
        el("div", { className: "empty__title" }, "이 조건에 맞는 논문·특허가 없어요"),
        el("div", { className: "empty__text" }, "타입 필터를 풀거나 다른 키워드를 넣어 보세요.")
      ));
      return;
    }
    // 논문·특허는 news 카드 form 재사용 — 같은 정보 구조 (title/summary/scores)
    const flagSets = {
      starred:    new Set(window.Storage ? window.Storage.getFlagged("starred")   : []),
      bookmarks:  new Set(window.Storage ? window.Storage.getFlagged("bookmarks") : []),
      read:       new Set(window.Storage ? window.Storage.getFlagged("read")      : []),
    };
    const frag = document.createDocumentFragment();
    list.forEach((r) => frag.appendChild(renderNewsCard(r, flagSets)));
    grid.replaceChildren(frag);
  }

  function renderOssCard(o) {
    // OSS 카드 재디자인 — 사용자 피드백:
    //   "stars/사용언어/라이센스 구분되지 않음, 무엇이 중요한지 모르겠음"
    //
    // 정보 위계 (상→하):
    //   1) 타입 + 트렌딩/한국 배지 (즉시 시각 분류)
    //   2) 저장소 이름 (큰 글자, mono — 가장 중요)
    //   3) 한 줄 설명
    //   4) [⭐ stars] [📈 +week] [💻 lang] [📜 license] (4-grid 정렬, 색 구분)
    //   5) Why important — 자동 생성 추론 한 줄
    //   6) GitHub 버튼 + contributors

    // 📦 Round 6: Why important 분석 강화 (사용자 피드백:
    //   "어떤 오픈소스이고 왜 뜨고 있는지 관심받고 있는지 분석해서 설명을 추가").
    // 다중 시그널을 결합해 1) 이게 무엇인지 + 2) 왜 뜨고 있는지를 같이.
    const desc = ko(o, "description");
    const isRising = (o.starsThisWeek || 0) >= 200;
    const isBigRise = (o.starsThisWeek || 0) >= 1000;
    const isEstablished = o.stars >= 50000;
    const isMature = o.stars >= 10000 && o.stars < 50000;
    const weeklyGrowthPct = o.stars > 0 ? Math.round((o.starsThisWeek || 0) / o.stars * 1000) / 10 : 0;

    // 첫 줄: 이게 뭔지 (타입 + 한 줄 요약 첫 80자)
    const whatIs = `${o.typeIcon || "📦"} ${o.typeLabel || o.type || "도구"}` +
      (desc ? ` · ${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}` : "");
    // 둘째 줄: 왜 뜨고 있는지 (성장 신호 + 검증 신호 결합)
    const whySignals = [];
    if (o.isTrending) whySignals.push("📈 GitHub Trending 진입");
    if (isBigRise) whySignals.push(`🚀 이번 주 +${fmtNum(o.starsThisWeek)} 별 (${weeklyGrowthPct}% 성장)`);
    else if (isRising) whySignals.push(`🔥 이번 주 +${fmtNum(o.starsThisWeek)} 별 가속 중`);
    if (isEstablished) whySignals.push("⭐ 50k+ — 업계 표준급");
    else if (isMature) whySignals.push("✅ 10k+ — 검증된 도구");
    if (o.isKorean) whySignals.push("🇰🇷 한국 OSS");
    if (o.contributors >= 100) whySignals.push(`👥 ${fmtNum(o.contributors)} 컨트리뷰터 — 활발한 커뮤니티`);
    else if (o.contributors >= 30) whySignals.push(`👥 ${fmtNum(o.contributors)} 컨트리뷰터 — 안정적 유지보수`);
    // 신생 프로젝트만 fallback
    if (whySignals.length === 0) whySignals.push("👀 신생 프로젝트 — 추적 후보");
    const whyImportant = `${whatIs}\n\n💡 주목 이유: ${whySignals.join(" · ")}`;

    return el("article", { className: "card oss-card", "data-id": o.id },
      // 1단: 타입 + 배지 (시각 분류 즉시)
      el("div", { className: "oss-card__top" },
        el("span", { className: "oss-card__type" }, `${o.typeIcon || "📦"} ${o.typeLabel || o.type || ""}`),
        o.isTrending ? el("span", { className: "oss-card__badge oss-card__badge--trending" }, "🔥 Trending") : null,
        o.isKorean   ? el("span", { className: "oss-card__badge oss-card__badge--korean"   }, "🇰🇷 KR") : null
      ),
      // 2단: 저장소 이름 (가장 중요한 정보)
      el("h3", { className: "oss-card__name-wrap" },
        el("a", {
          className: "oss-card__name",
          href: o.url, target: "_blank", rel: "noopener",
        }, o.name || "")
      ),
      // 3단: 한 줄 설명
      el("p", { className: "oss-card__desc" }, ko(o, "description")),
      // 4단: 4-stat grid — 각각 색·아이콘 구분
      el("div", { className: "oss-card__stats-grid" },
        el("div", { className: "oss-stat oss-stat--stars" },
          el("span", { className: "oss-stat__icon" }, "⭐"),
          el("span", { className: "oss-stat__value" }, fmtNum(o.stars)),
          el("span", { className: "oss-stat__label" }, "stars")
        ),
        el("div", { className: "oss-stat oss-stat--growth" },
          el("span", { className: "oss-stat__icon" }, "📈"),
          el("span", { className: "oss-stat__value" }, `+${fmtNum(o.starsThisWeek)}`),
          el("span", { className: "oss-stat__label" }, "this week")
        ),
        el("div", { className: "oss-stat oss-stat--lang" },
          el("span", { className: "oss-stat__icon" }, "💻"),
          el("span", { className: "oss-stat__value" }, o.language || "—"),
          el("span", { className: "oss-stat__label" }, "language")
        ),
        el("div", { className: "oss-stat oss-stat--license" },
          el("span", { className: "oss-stat__icon" }, "📜"),
          el("span", { className: "oss-stat__value" }, o.license || "—"),
          el("span", { className: "oss-stat__label" }, "license")
        )
      ),
      // 5단: 분석 — "이게 뭐고 왜 뜨는지" (Round 6 강화)
      el("div", { className: "oss-card__why" },
        el("p", { className: "oss-card__what" }, whatIs),
        el("p", { className: "oss-card__why-signals" },
          el("strong", null, "💡 주목 이유: "),
          whySignals.join(" · ")
        )
      ),
      // 6단: footer — contributors + 외부 링크
      el("div", { className: "oss-card__foot" },
        o.contributors ? el("span", { className: "oss-card__contrib" }, `👥 ${o.contributors} contrib`) : null,
        el("a", {
          className: "oss-card__link",
          href: o.url, target: "_blank", rel: "noopener",
          "aria-label": `${o.name} GitHub 저장소 새 창에서 열기`,
        }, "GitHub ↗")
      )
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

  function uniqueBy(arr, key) {
    const seen = new Set();
    const out = [];
    arr.forEach((x) => { if (!seen.has(x[key])) { seen.add(x[key]); out.push(x[key]); } });
    return out;
  }

  // ───────────────────────────────────────────────────────
  // 12. 부트
  // ───────────────────────────────────────────────────────
  // 숨김 탭은 LCP 이후 지연 init — 200+ 카드 동기 렌더가 LCP 6.5s까지 끌어올림.
  // perf-004 권고: 첫 paint에 보이는 news 탭만 동기, 나머지는 idle.
  function deferIdle(fn) {
    if (typeof requestIdleCallback === "function") {
      return requestIdleCallback(fn, { timeout: 2000 });
    }
    return setTimeout(fn, 50);
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      // PERF Round 4: pre-compute __hay/__avg index 1번 (boot 시 ~5ms for 322 items).
      // filterNews 매 키스트로크 시 string concat/lowercase 회피. 50+ keystrokes/min × 322 items
      // = 16k allocations 절감.
      buildNewsIndex();

      renderHero();
      setupTabRouter();
      setupNewsTab();         // 동기 — 첫 paint 대상 탭
      setupHeaderActions();
      // 숨김 탭은 LCP 이후 idle에 init.
      deferIdle(() => {
        try { setupCommunityTab(); } catch (e) { console.error(e); }
      });
      deferIdle(() => {
        try { setupOssTab(); } catch (e) { console.error(e); }
      });
      // Round 5: 논문·특허·표준 탭 (idle init)
      deferIdle(() => {
        try { setupResearchTab(); } catch (e) { console.error(e); }
      });
      deferIdle(() => {
        try {
          if (window.Insights && typeof window.Insights.init === "function") {
            window.Insights.init();
          }
        } catch (e) { console.error(e); }
      });
      // Cross-tab sync — when another tab toggles starred/bookmarks/read,
      // re-render the news grid so the user sees the change without manual
      // reload. Closes adversarial ADV-4 (lost-update perception).
      if (window.Storage && typeof window.Storage.onChange === "function") {
        const RERENDER_KEYS = new Set(["starred", "bookmarks", "read"]);
        window.Storage.onChange((key) => {
          if (RERENDER_KEYS.has(key)) renderNewsGrid();
        });
      }
    } catch (err) {
      console.error("[Daily News] init failed:", err);
    }
  });

  // ───────────────────────────────────────────────────────
  // 13. 외부 노출 — insights.js 가 사용하는 항목만. 나머지는 IIFE 클로저 내부.
  //     (renderGauges/switchTab/focusItem 은 app.js 내부에서만 호출됨)
  // ───────────────────────────────────────────────────────
  window.App = {
    renderMiniGauges,
  };
})();
