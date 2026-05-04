/**
 * themes.js — 추적 트렌드 키워드 (theme).
 *
 * 카테고리(spec § 9)보다 한 단계 깊은 화제 분류. 30+ 테마.
 * 각 theme는 매칭 키워드 배열로 자동 라벨링 (collect/score 단계).
 * Hero "오늘 떠오른 테마" strip로 노출, 클릭 시 검색어 자동 적용.
 */
window.__THEMES__ = [
  // ── AI / Agent 영역 ──────────────────────────────────
  { id: "agents-ga",        icon: "🤝", label: "Agents GA",
    keywords: ["agents api", "agents sdk", "multi-agent", "orchestration", "handoff", "agent framework"],
    parent: "ai" },
  { id: "computer-use",     icon: "🖥",  label: "Computer Use",
    keywords: ["computer use", "rpa", "screen reasoning", "browser automation", "claude computer"],
    parent: "ai" },
  { id: "reasoning-models", icon: "🧠", label: "Reasoning Models",
    keywords: ["reasoning", "o1", "o3", "test-time compute", "thinking", "chain of thought", "deep think"],
    parent: "ai" },
  { id: "model-context",    icon: "🔌", label: "MCP / Context",
    keywords: ["mcp", "model context protocol", "context engineering", "context window"],
    parent: "ai" },
  { id: "open-weights",     icon: "🔓", label: "Open Weights",
    keywords: ["llama", "open source model", "open weights", "deepseek", "qwen", "mistral", "phi-3"],
    parent: "ai" },
  { id: "rag-eval",         icon: "🔬", label: "RAG / Eval",
    keywords: ["retrieval", "rag", "eval", "evaluation", "benchmark", "leaderboard"],
    parent: "ai" },
  { id: "multimodal",       icon: "🎨", label: "Multimodal",
    keywords: ["multimodal", "vision-language", "image-to-text", "video understanding", "vlm"],
    parent: "ai" },
  { id: "ai-safety",        icon: "🛡", label: "AI Safety / Alignment",
    keywords: ["alignment", "ai safety", "interpretability", "red team", "jailbreak", "constitutional ai"],
    parent: "ai" },
  { id: "voice-ai",         icon: "🎙", label: "Voice AI",
    keywords: ["voice ai", "speech-to-speech", "tts", "stt", "real-time voice", "whisper"],
    parent: "ai" },
  { id: "image-gen",        icon: "🖼", label: "Image Generation",
    keywords: ["dall-e", "midjourney", "stable diffusion", "flux", "image generation", "diffusion model"],
    parent: "ai" },

  // ── DevTools 영역 ────────────────────────────────────
  { id: "ai-coding",        icon: "✏️", label: "AI Coding",
    keywords: ["copilot", "cursor", "codex", "claude code", "ai coding", "pair programming ai", "v0"],
    parent: "devtools" },
  { id: "edge-runtime",     icon: "🌐", label: "Edge Runtime",
    keywords: ["edge", "cloudflare workers", "vercel edge", "deno", "bun", "wasm"],
    parent: "devtools" },
  { id: "type-safety",      icon: "🔒", label: "Type Safety",
    keywords: ["typescript", "zod", "valibot", "type-safe", "rust", "go generics"],
    parent: "devtools" },
  { id: "build-tools",      icon: "🔨", label: "Build Tools",
    keywords: ["vite", "turbopack", "rspack", "esbuild", "build performance", "bundler"],
    parent: "devtools" },
  { id: "monorepo",         icon: "📦", label: "Monorepo",
    keywords: ["monorepo", "turborepo", "nx", "pnpm workspace", "yarn workspace", "moon"],
    parent: "devtools" },
  { id: "frontend-meta",    icon: "⚛️", label: "Frontend Meta",
    keywords: ["next.js", "remix", "react server component", "rsc", "qwik", "solidjs"],
    parent: "devtools" },
  { id: "database",         icon: "🗄", label: "Database",
    keywords: ["postgres", "mysql", "sqlite", "prisma", "drizzle", "neon", "planetscale", "supabase"],
    parent: "devtools" },
  { id: "vector-db",        icon: "🔮", label: "Vector DB",
    keywords: ["vector database", "pinecone", "weaviate", "chroma", "pgvector", "milvus", "qdrant"],
    parent: "devtools" },

  // ── AX 영역 ─────────────────────────────────────────
  { id: "dora-spc",         icon: "📊", label: "DORA / SPACE",
    keywords: ["dora", "space framework", "deployment frequency", "lead time", "mttr"],
    parent: "ax" },
  { id: "dx-survey",        icon: "📋", label: "DevEx Survey",
    keywords: ["dx survey", "developer experience", "internal nps", "developer satisfaction"],
    parent: "ax" },
  { id: "platform-eng",     icon: "🏗", label: "Platform Engineering",
    keywords: ["platform engineering", "internal platform", "golden path", "scaffold", "backstage"],
    parent: "ax" },
  { id: "incident-culture", icon: "🚨", label: "Incident Culture",
    keywords: ["postmortem", "blameless", "incident response", "sre", "error budget", "outage"],
    parent: "ax" },
  { id: "team-topology",    icon: "👥", label: "Team Topologies",
    keywords: ["team topology", "stream-aligned", "enabling team", "platform team"],
    parent: "ax" },
  { id: "remote-work",      icon: "🏠", label: "Remote Work",
    keywords: ["remote work", "async", "hybrid", "distributed team", "return to office", "rto"],
    parent: "ax" },

  // ── Robotics ────────────────────────────────────────
  { id: "humanoid",         icon: "🦾", label: "Humanoid",
    keywords: ["humanoid", "figure", "optimus", "tesla bot", "1x", "neo", "atlas robot"],
    parent: "robotics" },
  { id: "autonomous",       icon: "🚗", label: "Autonomous Driving",
    keywords: ["autonomous", "self-driving", "waymo", "cruise", "tesla fsd", "robotaxi"],
    parent: "robotics" },

  // ── Display / Mobile ─────────────────────────────────
  { id: "foldable",         icon: "📱", label: "Foldable",
    keywords: ["foldable", "폴더블", "z fold", "flip", "trifold", "rollable"],
    parent: "display" },
  { id: "ar-vr",            icon: "🥽", label: "AR / VR / XR",
    keywords: ["vision pro", "quest", "ar glasses", "xr", "spatial computing", "mixed reality"],
    parent: "display" },
  { id: "wearable",         icon: "⌚", label: "Wearable",
    keywords: ["smartwatch", "wearable", "fitbit", "apple watch", "galaxy watch", "ring"],
    parent: "display" },

  // ── Hardware / Semi ──────────────────────────────────
  { id: "ai-chip",          icon: "🔥", label: "AI Chip",
    keywords: ["h100", "h200", "b100", "b200", "blackwell", "mi300", "mi325", "tpu", "inferentia"],
    parent: "hardware" },
  { id: "memory-hbm",       icon: "💾", label: "HBM / Memory",
    keywords: ["hbm", "hbm3", "hbm3e", "ddr5", "lpddr5", "memory bandwidth"],
    parent: "hardware" },
  { id: "foundry",          icon: "🏭", label: "Foundry",
    keywords: ["tsmc", "samsung foundry", "intel foundry", "wafer", "yield", "3nm", "2nm"],
    parent: "hardware" },

  // ── Cloud / Infra ────────────────────────────────────
  { id: "cloud-cost",       icon: "💸", label: "Cloud Cost",
    keywords: ["finops", "cloud cost", "cost optimization", "aws bill", "egress fee", "spot instance"],
    parent: "ax" },
  { id: "kubernetes",       icon: "☸️", label: "Kubernetes / K8s",
    keywords: ["kubernetes", "k8s", "helm", "argocd", "kustomize", "ingress", "service mesh"],
    parent: "devtools" },

  // ── Security ─────────────────────────────────────────
  { id: "supply-chain",     icon: "🔗", label: "Supply Chain Sec",
    keywords: ["supply chain", "dependency", "sbom", "log4j", "npm attack", "pypi malicious"],
    parent: "ax" },
  { id: "data-privacy",     icon: "🔒", label: "Data Privacy",
    keywords: ["gdpr", "ccpa", "privacy", "encryption", "zero trust", "soc 2"],
    parent: "ax" },

  // ─────────── 🔬 Round 5: 삼성 리서치 연구분야 5 테마 ───────────
  // Samsung Research가 공식적으로 다루는 5대 연구 영역 + 1대 응용 (총 5):
  // (1) 6G·차세대 통신, (2) 온디바이스 AI, (3) 차세대 디스플레이, (4) 헬스케어 AI/디지털 헬스,
  // (5) 신소재·배터리·양자.
  { id: "6g-comm",          icon: "📡", label: "6G·차세대 통신",
    keywords: ["6g", "terahertz", "thz", "ris", "reconfigurable intelligent surface",
               "satellite communication", "ntn", "non-terrestrial", "기지국", "5g advanced",
               "5.5g", "open ran", "vran", "통신 표준", "3gpp"],
    parent: "telecom" },
  { id: "on-device-ai",     icon: "🧬", label: "온디바이스 AI",
    keywords: ["on-device ai", "edge ai", "on device llm", "tinyml", "quantization",
               "knowledge distillation", "mobile inference", "neural processing unit",
               "npu", "snpe", "qnn", "core ml", "tflite", "온디바이스", "엣지 ai"],
    parent: "ai" },
  { id: "next-display",     icon: "🌈", label: "차세대 디스플레이",
    keywords: ["micro-led", "microled", "qd-oled", "qd oled", "mini-led",
               "rollable", "stretchable", "transparent display", "투명 디스플레이",
               "ar glass display", "vr display", "lcos", "holographic display",
               "hdr10+", "8k panel"],
    parent: "display" },
  { id: "digital-health",   icon: "🩺", label: "헬스케어 AI",
    keywords: ["digital health", "medical ai", "fda approved ai", "wearable health",
               "ecg sensor", "blood pressure sensor", "cgm", "continuous glucose",
               "samsung health", "galaxy ring", "sleep tracking", "fitness ai",
               "헬스케어", "의료 ai", "원격의료"],
    parent: "ai" },
  { id: "advanced-materials", icon: "⚛️", label: "신소재·배터리·양자",
    keywords: ["solid state battery", "전고체 배터리", "graphene", "그래핀",
               "perovskite", "페로브스카이트", "quantum computing", "양자 컴퓨팅",
               "qubit", "초전도", "superconductor", "2d material", "carbon nanotube",
               "battery density", "lithium iron phosphate", "lfp", "고체 전해질"],
    parent: "ai" }, // 카테고리상 ai 부모이지만 cross-domain (display/hardware 등에 활용)
];

/** 테마 자동 매칭 — text에서 매치되는 themes 배열 반환.
 *  PERF Round 4 (Expert 8 Caswell): 35 themes × ~5 keywords = 175 substring tests/call,
 *  322 items × 2 (renderThemes+renderTechs collectAllText 호출) = 113k tests on hero paint.
 *  → 결합 alternation regex 1-pass + Map<keyword→themeIds> 로 ~10ms 절감.
 */
(function () {
  const themes = window.__THEMES__ || [];
  const kwToThemes = new Map(); // keyword(lc) → [themeId, ...]
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const allKeywords = [];
  for (const t of themes) {
    for (const kw of (t.keywords || [])) {
      const k = kw.toLowerCase();
      let arr = kwToThemes.get(k);
      if (!arr) { kwToThemes.set(k, arr = []); allKeywords.push(k); }
      arr.push(t.id);
    }
  }
  const COMBINED_RE = allKeywords.length
    ? new RegExp(allKeywords.map(escapeRe).join("|"), "gi")
    : null;
  window.__THEME_MATCH__ = function (text) {
    if (!text || !COMBINED_RE) return [];
    const lc = String(text).toLowerCase();
    COMBINED_RE.lastIndex = 0;
    const seen = new Set();
    let m;
    while ((m = COMBINED_RE.exec(lc)) !== null) {
      const ids = kwToThemes.get(m[0]);
      if (ids) for (const id of ids) seen.add(id);
    }
    return Array.from(seen);
  };
})();
