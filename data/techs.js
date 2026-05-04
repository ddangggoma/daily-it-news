/**
 * techs.js — 추적 기술 스택 / 도구 / 프레임워크.
 *
 * 31개 항목, 9개 그룹. 각 항목은 카드의 tags[]와 매칭하여 hero에 "오늘 언급된
 * 스택" 칩으로 노출. 클릭 시 해당 키워드로 검색.
 */
window.__TECHS__ = [
  // ── Models / LLM Providers ──────────────────────────
  { id: "openai",      label: "OpenAI",       icon: "✨", group: "models", url: "https://openai.com" },
  { id: "anthropic",   label: "Anthropic",    icon: "🟣", group: "models", url: "https://anthropic.com" },
  { id: "google-gemini", label: "Gemini",     icon: "💎", group: "models", url: "https://gemini.google.com" },
  { id: "meta-llama",  label: "Llama",        icon: "🦙", group: "models", url: "https://llama.com" },
  { id: "mistral",     label: "Mistral",      icon: "🌬", group: "models", url: "https://mistral.ai" },
  { id: "deepseek",    label: "DeepSeek",     icon: "🔵", group: "models", url: "https://deepseek.com" },

  // ── Agent Frameworks ────────────────────────────────
  { id: "openai-agents-sdk", label: "Agents SDK", icon: "🤖", group: "agents", url: "https://github.com/openai/agents-python" },
  { id: "langgraph",   label: "LangGraph",    icon: "🕸",  group: "agents", url: "https://langchain-ai.github.io/langgraph" },
  { id: "crewai",      label: "CrewAI",       icon: "👷", group: "agents", url: "https://crewai.com" },
  { id: "autogen",     label: "AutoGen",      icon: "🔄", group: "agents", url: "https://microsoft.github.io/autogen" },
  { id: "mcp",         label: "MCP",          icon: "🔌", group: "agents", url: "https://modelcontextprotocol.io" },

  // ── Frontend / UI ───────────────────────────────────
  { id: "react",       label: "React",        icon: "⚛️",  group: "frontend", url: "https://react.dev" },
  { id: "nextjs",      label: "Next.js",      icon: "▲",  group: "frontend", url: "https://nextjs.org" },
  { id: "svelte",      label: "Svelte",       icon: "🟠", group: "frontend", url: "https://svelte.dev" },
  { id: "vite",        label: "Vite",         icon: "⚡", group: "frontend", url: "https://vitejs.dev" },
  { id: "tailwind",    label: "Tailwind",     icon: "💨", group: "frontend", url: "https://tailwindcss.com" },
  { id: "shadcn",      label: "shadcn/ui",    icon: "⬛", group: "frontend", url: "https://ui.shadcn.com" },

  // ── Backend / Runtime ───────────────────────────────
  { id: "bun",         label: "Bun",          icon: "🥖", group: "runtime", url: "https://bun.sh" },
  { id: "deno",        label: "Deno",         icon: "🦕", group: "runtime", url: "https://deno.com" },
  { id: "node",        label: "Node.js",      icon: "🟢", group: "runtime", url: "https://nodejs.org" },
  { id: "rust",        label: "Rust",         icon: "🦀", group: "runtime", url: "https://rust-lang.org" },
  { id: "go",          label: "Go",           icon: "🐹", group: "runtime", url: "https://go.dev" },

  // ── Cloud / Edge ────────────────────────────────────
  { id: "vercel",      label: "Vercel",       icon: "△",  group: "cloud", url: "https://vercel.com" },
  { id: "cloudflare",  label: "Cloudflare",   icon: "☁️", group: "cloud", url: "https://cloudflare.com" },
  { id: "supabase",    label: "Supabase",     icon: "🟢", group: "cloud", url: "https://supabase.com" },
  { id: "neon",        label: "Neon",         icon: "🌿", group: "cloud", url: "https://neon.tech" },
  { id: "fly-io",      label: "Fly.io",       icon: "🪂", group: "cloud", url: "https://fly.io" },

  // ── DevTools ────────────────────────────────────────
  { id: "cursor",      label: "Cursor",       icon: "✏️", group: "devtools", url: "https://cursor.com" },
  { id: "claude-code", label: "Claude Code",  icon: "🟣", group: "devtools", url: "https://claude.com/claude-code" },
  { id: "github-copilot", label: "Copilot",   icon: "🐙", group: "devtools", url: "https://github.com/features/copilot" },
  { id: "playwright",  label: "Playwright",   icon: "🎭", group: "devtools", url: "https://playwright.dev" },

  // ── Korean Tech ─────────────────────────────────────
  { id: "naver-cloud", label: "Naver Cloud",  icon: "🟢", group: "korean",   url: "https://www.ncloud.com" },
  { id: "upstage-solar", label: "Upstage Solar", icon: "☀️", group: "korean", url: "https://upstage.ai" },
];

/** 텍스트(title+summary)에서 매칭되는 tech ids. label 부분 매칭. */
window.__TECH_MATCH__ = function (text) {
  if (!text) return [];
  const lc = String(text).toLowerCase();
  return (window.__TECHS__ || [])
    .filter((t) => lc.includes(t.label.toLowerCase()) || lc.includes(t.id.replace(/-/g, " ")))
    .map((t) => t.id);
};
