/**
 * spec.js — Single source of truth for Daily News domain enums (Node side).
 *
 * Browser side mirrors these in scripts/util.js (window.DN.CATEGORIES, etc.)
 * because the browser layer prefers no-build static loading. A unit test
 * (tests/unit/spec-drift.test.js) asserts the two stay in sync.
 *
 * If you change a category/tag here, update scripts/util.js and run
 * `npm run test:unit` — the drift test will catch any miss.
 *
 * Closes /ce-code-review maintainability M2 (CATEGORIES + INSIGHT_TAGS
 * defined twice with different shapes).
 */
"use strict";

// 🆕 Round 9: 사용자 요청 "뉴스의 AI, Dev Tools, AX, 로봇, 디스플레이, 디자인,
// 통신, 데이터는 기본 포함". 데이터 카테고리 신규 추가 + 핵심 IT 영역 보강.
const CATEGORIES = [
  // ── 사용자 지정 8개 기본 ──
  { key: "ai",          icon: "🤖", label: "AI" },
  { key: "devtools",    icon: "🛠",  label: "Dev Tools" },
  { key: "ax",          icon: "🎯", label: "AX" },
  { key: "robotics",    icon: "⚙️", label: "로봇" },
  { key: "display",     icon: "📺", label: "디스플레이" },
  { key: "design",      icon: "🎨", label: "디자인" },
  { key: "telecom",     icon: "📡", label: "통신" },
  { key: "data",        icon: "📊", label: "데이터" },
  // ── Round 9 신규 추가: 핵심 IT 영역 ──
  { key: "security",    icon: "🔒", label: "보안" },
  { key: "cloud",       icon: "☁️", label: "클라우드" },
  { key: "semiconductor", icon: "🔬", label: "반도체" },
  { key: "mobile",      icon: "📱", label: "모바일" },
  { key: "startup",     icon: "🚀", label: "스타트업" },
  // ── 별도 탭 (research) ──
  { key: "papers",      icon: "📄", label: "논문" },
  { key: "standards",   icon: "⚖️", label: "특허/표준" },
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

const INSIGHT_TAG_KEYS = ["opportunity", "pattern", "caution", "bullish"];

const INSIGHT_TAGS = {
  opportunity: { label: "💡 기회",  color: "#a855f7" },
  pattern:     { label: "📜 패턴",  color: "#7c2d12" },
  caution:     { label: "⚠ 경계",   color: "#ef4444" },
  bullish:     { label: "📈 강세",  color: "#10b981" },
};

const SCORE_KEYS = ["impact", "freshness", "depth", "buzz"];

module.exports = {
  CATEGORIES,
  CATEGORY_KEYS,
  INSIGHT_TAG_KEYS,
  INSIGHT_TAGS,
  SCORE_KEYS,
};
