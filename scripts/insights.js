/**
 * insights.js — 인사이트 탭 (10명 전문가 카드 + 모달).
 *
 * 노출:
 *   window.Insights = {
 *     init(),                           // app.js의 setupInsightsTab()이 호출
 *     openModal(insightOrId),
 *     closeModal(),
 *     mdToHtml(md),                     // 미니 마크다운 컨버터 (재사용 가능)
 *   }
 *
 * 의존:
 *   window.DN          (util.js — el, $, $$, escapeHtml, CATEGORY_BY_KEY, INSIGHT_TAGS)
 *   window.__DAILY__   (insights[], news[], oss[], community[])
 *   window.__EXPERTS__ (10명)
 *   window.App         (renderMiniGauges, focusItem, switchTab) — app.js 가 노출
 *
 * 파일프로토콜에서 동작. 외부 의존 0.
 */
(function () {
  "use strict";

  // 공유 헬퍼 + 상수 (util.js)
  const { el, $, $$, escapeHtml, CATEGORY_BY_KEY, INSIGHT_TAGS } = window.DN;
  // 카테고리 아이콘 (관련 뉴스 카드용 — key→icon만 사용)
  const CAT_ICON = Object.fromEntries(
    Object.entries(CATEGORY_BY_KEY).map(([k, v]) => [k, v.icon])
  );
  // 인사이트 태그 (util.js의 INSIGHT_TAGS 사용)
  const TAG_META = INSIGHT_TAGS;

  // ── 전문가 인덱스 ────────────────────────────────────
  function expertById(id) {
    return (window.__EXPERTS__ || []).find((e) => e.id === id) || null;
  }

  // ── 미니 마크다운 → HTML (외부 lib 없음) ─────────────
  // 지원: # / ## / ### 헤딩, **bold**, *italic*, `code`, - 또는 1. 리스트, 빈줄 = 문단
  function mdToHtml(md) {
    if (!md) return "";
    const lines = String(md).replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // 헤딩
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        const lvl = h[1].length;
        out.push(`<h${lvl + 2}>${inline(h[2])}</h${lvl + 2}>`);
        i++; continue;
      }

      // unordered list
      if (/^\s*-\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*-\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      // 빈 줄 (스킵)
      if (!line.trim()) { i++; continue; }

      // 일반 문단 — 다음 빈 줄까지 모음
      const para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*-\s|\s*\d+\.\s)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out.join("\n");

    function inline(s) {
      return escapeHtml(s)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    }
  }

  // ── 카드 렌더 ────────────────────────────────────────
  function renderCards(mode) {
    const grid = $("#insights-grid");
    if (!grid) return;
    grid.dataset.mode = mode;
    grid.innerHTML = "";

    const insights = (window.__DAILY__ && window.__DAILY__.insights) || [];

    insights.forEach((ins, idx) => {
      const expert = expertById(ins.expertId);
      if (!expert) return;

      const tag = TAG_META[ins.tag] || { label: ins.tag, color: "#64748b" };

      const card = el("article", {
        className: "insight-card",
        style: `border-left: 4px solid ${expert.color};`,
        role: "button",
        tabindex: "0",
        "data-insight-id": ins.id,
        "aria-label": `${expert.role} ${expert.name}: ${ins.title}`,
      });

      const head = el("div", { className: "insight-card__head" },
        el("span", { className: "insight-avatar", style: `background:${expert.color}1a;color:${expert.color}` }, expert.avatar),
        el("div", { className: "insight-card__who" },
          el("div", { className: "insight-card__role" }, expert.role,
            el("small", null, ` ${expert.roleEn || ""}`)
          ),
          el("div", { className: "insight-card__name" }, `코드명 ${expert.name} · ${expert.id}`)
        ),
        el("span", {
          className: "insight-tag",
          style: `background:${tag.color}1a;color:${tag.color};border-color:${tag.color}33;`,
        }, tag.label)
      );

      const title = el("h3", { className: "insight-card__title" }, ins.title);
      const excerpt = el("p", { className: "insight-card__excerpt" }, ins.excerpt);

      card.appendChild(head);
      card.appendChild(title);
      card.appendChild(excerpt);

      if (mode === "expanded") {
        const expanded = el("div", { className: "insight-card__expanded" });
        const kq = el("div", { className: "insight-card__kq" },
          el("span", { className: "insight-card__kq-label" }, "🔑 핵심 질문"),
          el("blockquote", null, ins.keyQuestion)
        );
        const analysisHtml = el("div", { className: "insight-card__analysis" });
        analysisHtml.innerHTML = mdToHtml(ins.analysis);
        expanded.appendChild(kq);
        expanded.appendChild(analysisHtml);
        card.appendChild(expanded);
      }

      const cta = el("div", { className: "insight-card__cta" }, "▶ 자세히 보기");
      card.appendChild(cta);

      // 클릭/Enter → 모달
      const open = (e) => {
        e.preventDefault();
        openModal(ins.id);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open(e);
      });

      grid.appendChild(card);
    });

    const counter = $("#insights-counter");
    if (counter) counter.textContent = `${insights.length}명 전문가`;
  }

  // ── 모달 ────────────────────────────────────────────
  let currentInsightIndex = -1;

  function findIndex(idOrInsight) {
    const id = typeof idOrInsight === "string" ? idOrInsight : (idOrInsight && idOrInsight.id);
    const arr = (window.__DAILY__ && window.__DAILY__.insights) || [];
    return arr.findIndex((x) => x.id === id);
  }

  function openModal(idOrInsight) {
    const idx = findIndex(idOrInsight);
    if (idx < 0) return;
    currentInsightIndex = idx;
    renderModal();

    const backdrop = $("#insight-modal");
    if (!backdrop) return;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";

    // ESC 닫기
    document.addEventListener("keydown", onKeydown);
    // 배경 클릭 닫기
    backdrop.addEventListener("click", onBackdropClick);
  }

  function closeModal() {
    const backdrop = $("#insight-modal");
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    if (backdrop) backdrop.removeEventListener("click", onBackdropClick);
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
    else if (e.key === "ArrowLeft") nav(-1);
    else if (e.key === "ArrowRight") nav(+1);
  }

  function onBackdropClick(e) {
    if (e.target.id === "insight-modal") closeModal();
  }

  function nav(delta) {
    const arr = (window.__DAILY__ && window.__DAILY__.insights) || [];
    if (!arr.length) return;
    currentInsightIndex = (currentInsightIndex + delta + arr.length) % arr.length;
    renderModal();
  }

  function renderModal() {
    const arr = (window.__DAILY__ && window.__DAILY__.insights) || [];
    const ins = arr[currentInsightIndex];
    if (!ins) return;

    const expert = expertById(ins.expertId);
    if (!expert) return;
    const tag = TAG_META[ins.tag] || { label: ins.tag, color: "#64748b" };

    const inner = $("#modal-inner");
    if (!inner) return;
    inner.innerHTML = "";

    // 헤더
    const head = el("div", { className: "modal__head" },
      el("span", { className: "insight-avatar", style: `background:${expert.color}1a;color:${expert.color}` }, expert.avatar),
      el("div", { className: "modal__who" },
        el("div", { className: "modal__role", id: "modal-role" }, `${expert.role} · ${expert.name}`),
        el("div", { className: "modal__sub" }, `${expert.roleEn || ""} · 코드명 ${expert.id}`)
      ),
      el("span", {
        className: "insight-tag",
        style: `background:${tag.color}1a;color:${tag.color};border-color:${tag.color}33;`,
      }, tag.label),
      el("button", {
        className: "modal__close",
        "aria-label": "닫기",
        onclick: closeModal,
      }, "✕")
    );

    // 본문
    const body = el("div", { className: "modal__body" });

    body.appendChild(section("👤 전문가 배경", el("p", null, expert.background || "")));
    body.appendChild(section("🔑 핵심 질문", el("blockquote", { className: "modal__kq" }, ins.keyQuestion || "")));

    const analysis = el("div", { className: "modal__analysis" });
    analysis.innerHTML = mdToHtml(ins.analysis || "");
    body.appendChild(section("📝 전체 분석", analysis));

    // 관련 항목
    const relNews = (ins.relatedNewsIds || []).map(findNews).filter(Boolean);
    const relOss  = (ins.relatedOssIds  || []).map(findOss).filter(Boolean);
    const relCom  = (ins.relatedCommunityIds || []).map(findCommunity).filter(Boolean);

    if (relNews.length) {
      body.appendChild(section(`📰 관련 뉴스 (${relNews.length})`, renderRelatedNews(relNews)));
    }
    if (relOss.length) {
      body.appendChild(section(`📦 관련 OSS (${relOss.length})`, renderRelatedOss(relOss)));
    }
    if (relCom.length) {
      body.appendChild(section(`💬 관련 커뮤니티 (${relCom.length})`, renderRelatedCommunity(relCom)));
    }

    // 푸터
    const total = arr.length;
    const pos = currentInsightIndex + 1;
    const foot = el("div", { className: "modal__foot" },
      el("button", { className: "modal__nav-btn", onclick: () => nav(-1), "aria-label": "이전" }, "← 이전"),
      el("span", { className: "modal__pos" }, `${pos} / ${total}`),
      el("button", { className: "modal__nav-btn", onclick: () => nav(+1), "aria-label": "다음" }, "다음 →"),
      el("span", { className: "modal__sep" }, ""),
      el("button", { className: "modal__copy-btn", onclick: () => copyMarkdown(ins) }, "📋 마크다운 복사"),
      el("button", { className: "modal__close-text", onclick: closeModal }, "닫기")
    );

    inner.appendChild(head);
    inner.appendChild(body);
    inner.appendChild(foot);
  }

  function section(title, contentNode) {
    const sec = el("section", { className: "modal__section" });
    sec.appendChild(el("h4", null, title));
    sec.appendChild(contentNode);
    return sec;
  }

  // ── 관련 항목 렌더 ───────────────────────────────────
  function findNews(id)      { return (window.__DAILY__.news      || []).find((x) => x.id === id); }
  function findOss(id)       { return (window.__DAILY__.oss       || []).find((x) => x.id === id); }
  function findCommunity(id) { return (window.__DAILY__.community || []).find((x) => x.id === id); }

  function renderRelatedNews(items) {
    const wrap = el("div", { className: "related-list" });
    items.forEach((n) => {
      const card = el("div", { className: "related-item related-item--news" });
      const top = el("div", { className: "related-item__top" },
        el("span", { className: "related-item__cat" }, CAT_ICON[n.category] || "📰"),
        el("a", { className: "related-item__title", href: n.url, target: "_blank", rel: "noopener" }, n.title || ""),
        el("span", { className: "related-item__src" }, n.source || "")
      );
      card.appendChild(top);

      // 미니 4-게이지 (App에서 노출)
      if (window.App && typeof window.App.renderMiniGauges === "function") {
        const gauges = window.App.renderMiniGauges(n.scores || {});
        card.appendChild(gauges);
      } else if (n.scores) {
        // fallback: 간단한 점수 라인
        const line = el("div", { className: "related-item__scores" },
          `🎯 ${n.scores.impact} · ⚡ ${n.scores.freshness} · 🔬 ${n.scores.depth} · 🔥 ${n.scores.buzz}`);
        card.appendChild(line);
      }
      wrap.appendChild(card);
    });
    return wrap;
  }

  function renderRelatedOss(items) {
    const wrap = el("div", { className: "related-list" });
    items.forEach((o) => {
      const card = el("div", { className: "related-item related-item--oss" },
        el("div", { className: "related-item__top" },
          el("span", { className: "related-item__cat" }, "📦"),
          el("a", { className: "related-item__title related-item__name", href: o.url, target: "_blank", rel: "noopener" }, o.name || ""),
          o.isKorean ? el("span", { className: "related-item__badge related-item__badge--kr" }, "🇰🇷") : null,
          o.isTrending ? el("span", { className: "related-item__badge related-item__badge--hot" }, "🔥") : null
        ),
        el("p", { className: "related-item__desc" }, o.description || ""),
        el("div", { className: "related-item__meta" },
          `⭐ ${(o.stars || 0).toLocaleString()} · +${(o.starsThisWeek || 0).toLocaleString()} · ${o.language || "—"} · ${o.license || "—"}`)
      );
      wrap.appendChild(card);
    });
    return wrap;
  }

  function renderRelatedCommunity(items) {
    const wrap = el("div", { className: "related-list" });
    items.forEach((c) => {
      const card = el("div", { className: "related-item related-item--community" },
        el("div", { className: "related-item__top" },
          el("span", { className: "related-item__cat" }, "💬"),
          el("a", { className: "related-item__title", href: c.url, target: "_blank", rel: "noopener" }, c.title || ""),
          el("span", { className: "related-item__src" }, c.source || "")
        ),
        el("div", { className: "related-item__meta" },
          `${(c.points || 0).toLocaleString()} pts · ${c.author || "—"}`)
      );
      wrap.appendChild(card);
    });
    return wrap;
  }

  // ── 마크다운 복사 ────────────────────────────────────
  function copyMarkdown(ins) {
    const expert = expertById(ins.expertId);
    const md = [
      `# ${ins.title}`,
      "",
      `**분야 전문가:** ${expert ? `${expert.role} · ${expert.name} (${expert.id})` : ins.expertId}`,
      "",
      `## 핵심 질문`,
      `> ${ins.keyQuestion}`,
      "",
      ins.analysis || "",
    ].join("\n");

    const ok = (msg) => toast(msg || "마크다운 복사됨 📋");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(() => ok(), () => fallbackCopy(md, ok));
    } else {
      fallbackCopy(md, ok);
    }
  }

  function fallbackCopy(text, onOk) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      onOk(ok ? "마크다운 복사됨 📋" : "복사 실패 — 수동 선택해 주세요");
    } catch (e) {
      onOk("복사 실패 — 수동 선택해 주세요");
    }
  }

  function toast(msg) {
    let t = document.getElementById("dn-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "dn-toast";
      t.className = "dn-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove("is-visible"), 2200);
  }

  // ── 초기화 (app.js가 호출) ───────────────────────────
  function init() {
    if (!document.getElementById("insights-grid")) return;

    // view 토글
    const view = $("#insights-view");
    if (view) {
      $$("button[data-view]", view).forEach((btn) => {
        btn.addEventListener("click", () => {
          $$("button[data-view]", view).forEach((b) => b.removeAttribute("data-active"));
          btn.setAttribute("data-active", "true");
          renderCards(btn.dataset.view);
        });
      });
    }

    // 초기 컴팩트 모드
    renderCards("compact");

    // 카운트
    const cnt = $("#count-insights");
    if (cnt) cnt.textContent = (window.__DAILY__.insights || []).length;
  }

  // ── 노출 ─────────────────────────────────────────────
  window.Insights = {
    init,
    openModal,
    closeModal,
    mdToHtml,
    toast,
  };
})();
