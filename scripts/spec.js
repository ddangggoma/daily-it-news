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
