/**
 * influencers.js — 추적 중인 인플루언서 풀.
 *
 * 카테고리별 그룹화. hero strip은 randomized rotation으로 매일 다른 8명 표시.
 * 카드 클릭 시 X(트위터) 프로필 링크로 이동.
 *
 * 갱신: 인플루언서 추가 시 카테고리에 맞는 그룹에 push. 새 카테고리 신설 시
 * data/themes.js에도 동기화 검토.
 */
window.__INFLUENCERS__ = {
  // ── AI Frontier (frontier 모델·인프라 결정자) ─────────
  ai_frontier: [
    { name: "Sam Altman",         handle: "@sama",          avatar: "🚀", role: "OpenAI CEO",      url: "https://x.com/sama" },
    { name: "Dario Amodei",       handle: "@DarioAmodei",   avatar: "🔬", role: "Anthropic CEO",   url: "https://x.com/DarioAmodei" },
    { name: "Demis Hassabis",     handle: "@demishassabis", avatar: "🧬", role: "DeepMind CEO",    url: "https://x.com/demishassabis" },
    { name: "Andrej Karpathy",    handle: "@karpathy",      avatar: "🧠", role: "ex-Tesla AI",     url: "https://x.com/karpathy" },
    { name: "Yann LeCun",         handle: "@ylecun",        avatar: "🐱", role: "Meta Chief AI",   url: "https://x.com/ylecun" },
    { name: "Greg Brockman",      handle: "@gdb",           avatar: "⚡", role: "OpenAI President",url: "https://x.com/gdb" },
    { name: "Mira Murati",        handle: "@miramurati",    avatar: "🌐", role: "Thinking Machines", url: "https://x.com/miramurati" },
    { name: "Ilya Sutskever",     handle: "@ilyasut",       avatar: "🧮", role: "SSI co-founder",  url: "https://x.com/ilyasut" },
    { name: "Mustafa Suleyman",   handle: "@mustafasuleyman", avatar: "🌊", role: "Microsoft AI",  url: "https://x.com/mustafasuleyman" },
    { name: "Aravind Srinivas",   handle: "@AravSrinivas",  avatar: "🔍", role: "Perplexity CEO",  url: "https://x.com/AravSrinivas" },
  ],

  // ── Researchers / Open Source AI ─────────────────────
  ai_research: [
    { name: "Jim Fan",            handle: "@DrJimFan",      avatar: "🤖", role: "NVIDIA AI Researcher", url: "https://x.com/DrJimFan" },
    { name: "Sebastian Raschka",  handle: "@rasbt",         avatar: "📚", role: "AI educator",     url: "https://x.com/rasbt" },
    { name: "Hugging Face",       handle: "@huggingface",   avatar: "🤗", role: "open ML",         url: "https://x.com/huggingface" },
    { name: "Tri Dao",            handle: "@tri_dao",       avatar: "⚙️", role: "Flash Attention", url: "https://x.com/tri_dao" },
    { name: "Andrew Ng",          handle: "@AndrewYNg",     avatar: "🎓", role: "DeepLearning.AI", url: "https://x.com/AndrewYNg" },
    { name: "François Chollet",   handle: "@fchollet",      avatar: "🌌", role: "Keras creator",   url: "https://x.com/fchollet" },
    { name: "Jeremy Howard",      handle: "@jeremyphoward", avatar: "🚂", role: "fast.ai",         url: "https://x.com/jeremyphoward" },
  ],

  // ── DevTools / Engineering Leaders ───────────────────
  devtools: [
    { name: "Guillermo Rauch",    handle: "@rauchg",        avatar: "△",  role: "Vercel CEO",      url: "https://x.com/rauchg" },
    { name: "Paul Copplestone",   handle: "@kiwicopple",    avatar: "🟢", role: "Supabase CEO",    url: "https://x.com/kiwicopple" },
    { name: "Matt Mullenweg",     handle: "@photomatt",     avatar: "📝", role: "Automattic CEO",  url: "https://x.com/photomatt" },
    { name: "Tobi Lütke",         handle: "@tobi",          avatar: "🛍", role: "Shopify CEO",     url: "https://x.com/tobi" },
    { name: "Patrick Collison",   handle: "@patrickc",      avatar: "💳", role: "Stripe CEO",      url: "https://x.com/patrickc" },
    { name: "John Collison",      handle: "@collision",     avatar: "💳", role: "Stripe President",url: "https://x.com/collision" },
    { name: "Cassidy Williams",   handle: "@cassidoo",      avatar: "👩‍💻", role: "DX advocate",   url: "https://x.com/cassidoo" },
    { name: "Theo Browne",        handle: "@theo",          avatar: "📺", role: "Ping/T3 stack",   url: "https://x.com/theo" },
    { name: "Dan Abramov",        handle: "@dan_abramov2",  avatar: "⚛️", role: "React core",       url: "https://x.com/dan_abramov2" },
    { name: "Rich Harris",        handle: "@Rich_Harris",   avatar: "🟠", role: "Svelte",          url: "https://x.com/Rich_Harris" },
  ],

  // ── AX (Engineering Culture / Productivity) ──────────
  ax_culture: [
    { name: "Will Larson",        handle: "@Lethain",       avatar: "📐", role: "Carta CTO, Elegant Puzzle", url: "https://x.com/Lethain" },
    { name: "Charity Majors",     handle: "@mipsytipsy",    avatar: "🍯", role: "Honeycomb co-founder",      url: "https://x.com/mipsytipsy" },
    { name: "Camille Fournier",   handle: "@skamille",      avatar: "🎯", role: "Manager's Path",            url: "https://x.com/skamille" },
    { name: "Tanya Reilly",       handle: "@whereistanya",  avatar: "🧭", role: "Staff Engineer's Path",     url: "https://x.com/whereistanya" },
    { name: "Lara Hogan",         handle: "@lara_hogan",    avatar: "🧘", role: "Resilient Mgmt",            url: "https://x.com/lara_hogan" },
    { name: "Gergely Orosz",      handle: "@GergelyOrosz",  avatar: "🟦", role: "Pragmatic Engineer",        url: "https://x.com/GergelyOrosz" },
    { name: "Kelsey Hightower",   handle: "@kelseyhightower", avatar: "☸️", role: "infra philosophy",        url: "https://x.com/kelseyhightower" },
    { name: "John Allspaw",       handle: "@allspaw",       avatar: "🛡", role: "ex-Etsy CTO, postmortems",  url: "https://x.com/allspaw" },
  ],

  // ── Robotics / Hardware ──────────────────────────────
  robotics: [
    { name: "Brett Adcock",       handle: "@adcock_brett",  avatar: "🦾", role: "Figure CEO",      url: "https://x.com/adcock_brett" },
    { name: "Daniela Rus",        handle: "@danielarus",    avatar: "🤖", role: "MIT CSAIL",       url: "https://x.com/danielarus" },
    { name: "Marc Raibert",       handle: "@RaibertMarc",   avatar: "🐕", role: "Boston Dynamics", url: "https://x.com/RaibertMarc" },
    { name: "Pieter Abbeel",      handle: "@pabbeel",       avatar: "🦿", role: "Covariant",       url: "https://x.com/pabbeel" },
  ],

  // ── Display / Hardware (Korean + Global) ─────────────
  hardware: [
    { name: "Jensen Huang",       handle: "@nvidia",        avatar: "🟩", role: "NVIDIA CEO (org)",url: "https://x.com/nvidia" },
    { name: "Lisa Su",            handle: "@LisaSu",        avatar: "🔴", role: "AMD CEO",         url: "https://x.com/LisaSu" },
    { name: "Pat Gelsinger",      handle: "@PGelsinger",    avatar: "🔵", role: "ex-Intel CEO",    url: "https://x.com/PGelsinger" },
    { name: "Anandtech",          handle: "@anandtech",     avatar: "🔬", role: "HW deep-dives",   url: "https://x.com/anandtech" },
  ],

  // ── 한국 (Korean Tech Leaders) ────────────────────────
  korean: [
    { name: "이수안",             handle: "@suanlab",       avatar: "🇰🇷", role: "AI 강의자",       url: "https://x.com/suanlab" },
    { name: "안성진",             handle: "@sungjin_an",    avatar: "📱", role: "삼성 폼팩터",     url: "https://x.com/sungjin_an" },
    { name: "Lilys AI",           handle: "@lilys_ai",      avatar: "🌷", role: "한국 AI SaaS",   url: "https://x.com/lilys_ai" },
    { name: "Toss Tech",          handle: "@toss_tech",     avatar: "💸", role: "토스 엔지니어링",  url: "https://x.com/toss_tech" },
    { name: "Naver Cloud",        handle: "@navercloud",    avatar: "🟢", role: "네이버 클라우드",  url: "https://x.com/navercloud" },
    { name: "Kakao Brain",        handle: "@kakaobrain",    avatar: "🟡", role: "카카오 AI",       url: "https://x.com/kakaobrain" },
    { name: "Upstage",            handle: "@upstageai",     avatar: "🚀", role: "Solar LLM",       url: "https://x.com/upstageai" },
    { name: "Ridge-i",            handle: "@ridge_i_kr",    avatar: "🏔", role: "산업 AI",         url: "https://x.com/ridge_i_kr" },
  ],

  // ── Investors / Operators ────────────────────────────
  investors: [
    { name: "Marc Andreessen",    handle: "@pmarca",        avatar: "🎩", role: "a16z",            url: "https://x.com/pmarca" },
    { name: "Garry Tan",          handle: "@garrytan",      avatar: "🟧", role: "Y Combinator CEO",url: "https://x.com/garrytan" },
    { name: "Paul Graham",        handle: "@paulg",         avatar: "📜", role: "YC founder",      url: "https://x.com/paulg" },
    { name: "Naval Ravikant",     handle: "@naval",         avatar: "🌌", role: "AngelList",       url: "https://x.com/naval" },
    { name: "Chamath",            handle: "@chamath",       avatar: "📈", role: "Social Capital",  url: "https://x.com/chamath" },
  ],

  // ── Design Critics ───────────────────────────────────
  design: [
    { name: "Dieter Rams",        handle: "",               avatar: "📐", role: "less but better", url: "" },
    { name: "Soleio",             handle: "@soleio",        avatar: "🎨", role: "Combine VC",      url: "https://x.com/soleio" },
    { name: "Julie Zhuo",         handle: "@joulee",        avatar: "📓", role: "Sundial co-founder", url: "https://x.com/joulee" },
    { name: "Brian Lovin",        handle: "@brian_lovin",   avatar: "🌀", role: "Campsite",        url: "https://x.com/brian_lovin" },
    { name: "Tobias van Schneider", handle: "@vanschneider", avatar: "🌒", role: "Semplice",       url: "https://x.com/vanschneider" },
  ],
};

/**
 * 매일 hero strip에 표시할 8명 선정.
 * - 카테고리별 1명씩 + 부족분은 ai_frontier에서 보충.
 * - 일관성 있게 매일 다른 조합이 나오도록 date string을 seed로.
 */
window.__INFLUENCERS_DAILY__ = function (dateStr) {
  const groups = window.__INFLUENCERS__ || {};
  const order = ["ai_frontier", "ai_research", "devtools", "ax_culture", "robotics", "hardware", "korean", "investors", "design"];
  // simple seedable hash
  const seed = String(dateStr || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = [];
  order.forEach((k, i) => {
    const arr = groups[k] || [];
    if (!arr.length) return;
    const idx = (seed + i * 7) % arr.length;
    out.push({ ...arr[idx], category: k });
  });
  return out.slice(0, 8);
};
