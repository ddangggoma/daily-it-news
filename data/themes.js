/**
 * themes.js — 추적 트렌드 키워드 (theme).
 *
 * 카테고리(spec § 9)보다 한 단계 깊은 화제 분류.
 * 각 theme는 매칭 키워드 배열로 자동 라벨링 가능 (collect/score 단계).
 * Hero에 "오늘 떠오른 테마" strip로 노출, 클릭 시 검색어 자동 적용.
 */
window.__THEMES__ = [
  // ── AI / Agent 영역 ──────────────────────────────────
  { id: "agents-ga",        icon: "🤝", label: "Agents GA",
    keywords: ["agents api", "agents sdk", "multi-agent", "orchestration", "handoff"],
    parent: "ai" },
  { id: "computer-use",     icon: "🖥",  label: "Computer Use",
    keywords: ["computer use", "rpa", "screen reasoning", "browser automation"],
    parent: "ai" },
  { id: "reasoning-models", icon: "🧠", label: "Reasoning Models",
    keywords: ["reasoning", "o1", "o3", "test-time compute", "thinking", "chain of thought"],
    parent: "ai" },
  { id: "model-context",    icon: "🔌", label: "MCP / Context",
    keywords: ["mcp", "model context protocol", "context engineering"],
    parent: "ai" },
  { id: "open-weights",     icon: "🔓", label: "Open Weights",
    keywords: ["llama", "open source model", "open weights", "deepseek", "qwen", "mistral"],
    parent: "ai" },
  { id: "rag-eval",         icon: "🔬", label: "RAG / Eval",
    keywords: ["retrieval", "rag", "eval", "evaluation", "benchmark"],
    parent: "ai" },

  // ── DevTools 영역 ────────────────────────────────────
  { id: "ai-coding",        icon: "✏️", label: "AI Coding",
    keywords: ["copilot", "cursor", "codex", "claude code", "ai coding", "pair programming ai"],
    parent: "devtools" },
  { id: "edge-runtime",     icon: "🌐", label: "Edge Runtime",
    keywords: ["edge", "cloudflare workers", "vercel edge", "deno", "bun"],
    parent: "devtools" },
  { id: "type-safety",      icon: "🔒", label: "Type Safety",
    keywords: ["typescript", "zod", "valibot", "type-safe", "rust"],
    parent: "devtools" },
  { id: "build-tools",      icon: "🔨", label: "Build Tools",
    keywords: ["vite", "turbopack", "rspack", "esbuild", "build performance"],
    parent: "devtools" },

  // ── AX 영역 ─────────────────────────────────────────
  { id: "dora-spc",         icon: "📊", label: "DORA / SPACE",
    keywords: ["dora", "space framework", "deployment frequency", "lead time", "mttr"],
    parent: "ax" },
  { id: "dx-survey",        icon: "📋", label: "DevEx Survey",
    keywords: ["dx survey", "developer experience", "internal nps", "developer satisfaction"],
    parent: "ax" },
  { id: "platform-eng",     icon: "🏗", label: "Platform Engineering",
    keywords: ["platform engineering", "internal platform", "golden path", "scaffold"],
    parent: "ax" },
  { id: "incident-culture", icon: "🚨", label: "Incident Culture",
    keywords: ["postmortem", "blameless", "incident response", "sre", "error budget"],
    parent: "ax" },
  { id: "team-topology",    icon: "👥", label: "Team Topologies",
    keywords: ["team topology", "stream-aligned", "enabling team", "platform team"],
    parent: "ax" },

  // ── Robotics ────────────────────────────────────────
  { id: "humanoid",         icon: "🦾", label: "Humanoid",
    keywords: ["humanoid", "figure", "optimus", "tesla bot", "1x"],
    parent: "robotics" },

  // ── Display ─────────────────────────────────────────
  { id: "foldable",         icon: "📱", label: "Foldable",
    keywords: ["foldable", "폴더블", "z fold", "flip"],
    parent: "display" },
  { id: "ar-vr",            icon: "🥽", label: "AR/VR",
    keywords: ["vision pro", "quest", "ar glasses", "xr"],
    parent: "display" },
];

/** 테마 자동 매칭 — text(title+summary)에서 매치되는 themes 배열 반환. */
window.__THEME_MATCH__ = function (text) {
  if (!text) return [];
  const lc = String(text).toLowerCase();
  return (window.__THEMES__ || [])
    .filter((t) => (t.keywords || []).some((kw) => lc.includes(kw.toLowerCase())))
    .map((t) => t.id);
};
