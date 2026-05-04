/**
 * influencers.js — 추적 중인 인플루언서 풀 (100+).
 *
 * 카테고리별 그룹화. hero strip은 daily-rotation으로 매일 다른 24명을
 * 4×6 그리드로 표시 (이전: 8명 단일 strip).
 *
 * 추가/갱신 시 카테고리 매칭. 새 카테고리 신설 시 themes.js와 동기화.
 */
window.__INFLUENCERS__ = {
  // ── AI Frontier (frontier 모델·인프라 결정자) — 18명 ────
  ai_frontier: [
    { name: "Sam Altman",         handle: "@sama",          avatar: "🚀", role: "OpenAI CEO",            url: "https://x.com/sama" },
    { name: "Dario Amodei",       handle: "@DarioAmodei",   avatar: "🔬", role: "Anthropic CEO",         url: "https://x.com/DarioAmodei" },
    { name: "Demis Hassabis",     handle: "@demishassabis", avatar: "🧬", role: "DeepMind CEO",          url: "https://x.com/demishassabis" },
    { name: "Andrej Karpathy",    handle: "@karpathy",      avatar: "🧠", role: "Eureka Labs",           url: "https://x.com/karpathy" },
    { name: "Yann LeCun",         handle: "@ylecun",        avatar: "🐱", role: "Meta Chief AI",         url: "https://x.com/ylecun" },
    { name: "Greg Brockman",      handle: "@gdb",           avatar: "⚡", role: "OpenAI President",      url: "https://x.com/gdb" },
    { name: "Mira Murati",        handle: "@miramurati",    avatar: "🌐", role: "Thinking Machines",     url: "https://x.com/miramurati" },
    { name: "Ilya Sutskever",     handle: "@ilyasut",       avatar: "🧮", role: "SSI",                   url: "https://x.com/ilyasut" },
    { name: "Mustafa Suleyman",   handle: "@mustafasuleyman", avatar: "🌊", role: "Microsoft AI CEO",   url: "https://x.com/mustafasuleyman" },
    { name: "Aravind Srinivas",   handle: "@AravSrinivas",  avatar: "🔍", role: "Perplexity CEO",        url: "https://x.com/AravSrinivas" },
    { name: "Jared Kaplan",       handle: "@jaredkaplan_",  avatar: "📐", role: "Anthropic Co-founder",  url: "https://x.com/jaredkaplan_" },
    { name: "Liang Wenfeng",      handle: "",               avatar: "🐳", role: "DeepSeek CEO",          url: "" },
    { name: "Bret Taylor",        handle: "@btaylor",       avatar: "🪶", role: "Sierra CEO",            url: "https://x.com/btaylor" },
    { name: "Chris Lattner",      handle: "@clattner_llvm", avatar: "🦀", role: "Modular CEO",           url: "https://x.com/clattner_llvm" },
    { name: "Emad Mostaque",      handle: "@EMostaque",     avatar: "🎨", role: "ex-Stability",          url: "https://x.com/EMostaque" },
    { name: "Noam Shazeer",       handle: "@NoamShazeer",   avatar: "✨", role: "Google",                url: "https://x.com/NoamShazeer" },
    { name: "Jakub Pachocki",     handle: "",               avatar: "🧪", role: "OpenAI Chief Scientist",url: "" },
    { name: "Reid Hoffman",       handle: "@reidhoffman",   avatar: "🤝", role: "Inflection Co-founder", url: "https://x.com/reidhoffman" },
  ],

  // ── AI Research / Open Source — 14명 ─────────────────
  ai_research: [
    { name: "Jim Fan",            handle: "@DrJimFan",      avatar: "🤖", role: "NVIDIA AI Lead",        url: "https://x.com/DrJimFan" },
    { name: "Sebastian Raschka",  handle: "@rasbt",         avatar: "📚", role: "AI educator",           url: "https://x.com/rasbt" },
    { name: "Hugging Face",       handle: "@huggingface",   avatar: "🤗", role: "open ML",               url: "https://x.com/huggingface" },
    { name: "Tri Dao",            handle: "@tri_dao",       avatar: "⚙️", role: "Flash Attention",       url: "https://x.com/tri_dao" },
    { name: "Andrew Ng",          handle: "@AndrewYNg",     avatar: "🎓", role: "DeepLearning.AI",       url: "https://x.com/AndrewYNg" },
    { name: "François Chollet",   handle: "@fchollet",      avatar: "🌌", role: "Keras creator",         url: "https://x.com/fchollet" },
    { name: "Jeremy Howard",      handle: "@jeremyphoward", avatar: "🚂", role: "fast.ai",               url: "https://x.com/jeremyphoward" },
    { name: "Aleksander Madry",   handle: "@aleks_madry",   avatar: "🔐", role: "MIT, OpenAI",           url: "https://x.com/aleks_madry" },
    { name: "Percy Liang",        handle: "@percyliang",    avatar: "🏛", role: "Stanford CRFM",         url: "https://x.com/percyliang" },
    { name: "Chelsea Finn",       handle: "@chelseabfinn",  avatar: "🎯", role: "Stanford, Google Brain",url: "https://x.com/chelseabfinn" },
    { name: "Dario Gil",          handle: "",               avatar: "🔮", role: "IBM Research SVP",      url: "" },
    { name: "Yi Tay",             handle: "@YiTayML",       avatar: "🧙", role: "Reka AI",               url: "https://x.com/YiTayML" },
    { name: "Aidan Gomez",        handle: "@aidangomez",    avatar: "🌟", role: "Cohere CEO",            url: "https://x.com/aidangomez" },
    { name: "Sara Hooker",        handle: "@sarahookr",     avatar: "🪐", role: "Cohere For AI",         url: "https://x.com/sarahookr" },
  ],

  // ── DevTools / Engineering Leaders — 16명 ────────────
  devtools: [
    { name: "Guillermo Rauch",    handle: "@rauchg",        avatar: "△",  role: "Vercel CEO",            url: "https://x.com/rauchg" },
    { name: "Paul Copplestone",   handle: "@kiwicopple",    avatar: "🟢", role: "Supabase CEO",          url: "https://x.com/kiwicopple" },
    { name: "Matt Mullenweg",     handle: "@photomatt",     avatar: "📝", role: "Automattic CEO",        url: "https://x.com/photomatt" },
    { name: "Tobi Lütke",         handle: "@tobi",          avatar: "🛍", role: "Shopify CEO",           url: "https://x.com/tobi" },
    { name: "Patrick Collison",   handle: "@patrickc",      avatar: "💳", role: "Stripe CEO",            url: "https://x.com/patrickc" },
    { name: "John Collison",      handle: "@collision",     avatar: "💳", role: "Stripe President",      url: "https://x.com/collision" },
    { name: "Cassidy Williams",   handle: "@cassidoo",      avatar: "👩‍💻", role: "DX advocate",         url: "https://x.com/cassidoo" },
    { name: "Theo Browne",        handle: "@theo",          avatar: "📺", role: "Ping/T3 stack",         url: "https://x.com/theo" },
    { name: "Dan Abramov",        handle: "@dan_abramov2",  avatar: "⚛️", role: "React core",            url: "https://x.com/dan_abramov2" },
    { name: "Rich Harris",        handle: "@Rich_Harris",   avatar: "🟠", role: "Svelte",                url: "https://x.com/Rich_Harris" },
    { name: "Evan You",           handle: "@youyuxi",       avatar: "🟢", role: "Vue/Vite",              url: "https://x.com/youyuxi" },
    { name: "Ryan Dahl",          handle: "@rough__sea",    avatar: "🦕", role: "Deno/Node creator",     url: "https://x.com/rough__sea" },
    { name: "Jarred Sumner",      handle: "@jarredsumner",  avatar: "🍞", role: "Bun creator",           url: "https://x.com/jarredsumner" },
    { name: "Lee Robinson",       handle: "@leeerob",       avatar: "🚀", role: "Vercel VP DX",          url: "https://x.com/leeerob" },
    { name: "Wes Bos",            handle: "@wesbos",        avatar: "📚", role: "JS educator",           url: "https://x.com/wesbos" },
    { name: "Nat Friedman",       handle: "@natfriedman",   avatar: "🐙", role: "ex-GitHub CEO",         url: "https://x.com/natfriedman" },
  ],

  // ── AX / Engineering Culture — 12명 ──────────────────
  ax_culture: [
    { name: "Will Larson",        handle: "@Lethain",       avatar: "📐", role: "Carta CTO",             url: "https://x.com/Lethain" },
    { name: "Charity Majors",     handle: "@mipsytipsy",    avatar: "🍯", role: "Honeycomb co-founder",  url: "https://x.com/mipsytipsy" },
    { name: "Camille Fournier",   handle: "@skamille",      avatar: "🎯", role: "Manager's Path author", url: "https://x.com/skamille" },
    { name: "Tanya Reilly",       handle: "@whereistanya",  avatar: "🧭", role: "Staff Engineer's Path", url: "https://x.com/whereistanya" },
    { name: "Lara Hogan",         handle: "@lara_hogan",    avatar: "🧘", role: "Resilient Mgmt",        url: "https://x.com/lara_hogan" },
    { name: "Gergely Orosz",      handle: "@GergelyOrosz",  avatar: "🟦", role: "Pragmatic Engineer",    url: "https://x.com/GergelyOrosz" },
    { name: "Kelsey Hightower",   handle: "@kelseyhightower", avatar: "☸️", role: "infra philosophy",   url: "https://x.com/kelseyhightower" },
    { name: "John Allspaw",       handle: "@allspaw",       avatar: "🛡", role: "ex-Etsy CTO",           url: "https://x.com/allspaw" },
    { name: "Laura Tacho",        handle: "@rallat",        avatar: "📊", role: "DX coach",              url: "https://x.com/rallat" },
    { name: "Patrick Kua",        handle: "@patkua",        avatar: "🎓", role: "Tech Leadership",       url: "https://x.com/patkua" },
    { name: "Kent Beck",          handle: "@KentBeck",      avatar: "🟫", role: "TDD/XP creator",        url: "https://x.com/KentBeck" },
    { name: "Martin Fowler",      handle: "@martinfowler",  avatar: "🌿", role: "Refactoring",           url: "https://x.com/martinfowler" },
  ],

  // ── Robotics / Autonomy — 8명 ────────────────────────
  robotics: [
    { name: "Brett Adcock",       handle: "@adcock_brett",  avatar: "🦾", role: "Figure CEO",            url: "https://x.com/adcock_brett" },
    { name: "Daniela Rus",        handle: "@danielarus",    avatar: "🤖", role: "MIT CSAIL",             url: "https://x.com/danielarus" },
    { name: "Marc Raibert",       handle: "@RaibertMarc",   avatar: "🐕", role: "Boston Dynamics",       url: "https://x.com/RaibertMarc" },
    { name: "Pieter Abbeel",      handle: "@pabbeel",       avatar: "🦿", role: "Covariant",             url: "https://x.com/pabbeel" },
    { name: "Bernt Børnich",      handle: "@bernt1x",       avatar: "🤲", role: "1X Technologies CEO",   url: "https://x.com/bernt1x" },
    { name: "Amir Husain",        handle: "@amirhusain",    avatar: "✈️", role: "SparkCognition",        url: "https://x.com/amirhusain" },
    { name: "Rohan Paul",         handle: "@rohanpaul_ai",  avatar: "📡", role: "Robotics analysis",     url: "https://x.com/rohanpaul_ai" },
    { name: "Carolina Parada",    handle: "",               avatar: "🚗", role: "Google DeepMind Robotics", url: "" },
  ],

  // ── Hardware / Semiconductor — 10명 ──────────────────
  hardware: [
    { name: "Jensen Huang",       handle: "@nvidia",        avatar: "🟩", role: "NVIDIA CEO",            url: "https://x.com/nvidia" },
    { name: "Lisa Su",            handle: "@LisaSu",        avatar: "🔴", role: "AMD CEO",               url: "https://x.com/LisaSu" },
    { name: "Pat Gelsinger",      handle: "@PGelsinger",    avatar: "🔵", role: "ex-Intel CEO",          url: "https://x.com/PGelsinger" },
    { name: "Anandtech",          handle: "@anandtech",     avatar: "🔬", role: "HW deep-dives",         url: "https://x.com/anandtech" },
    { name: "Dylan Patel",        handle: "@dylan522p",     avatar: "📈", role: "SemiAnalysis",          url: "https://x.com/dylan522p" },
    { name: "Ian Cutress",        handle: "@IanCutress",    avatar: "🧪", role: "More Than Moore",       url: "https://x.com/IanCutress" },
    { name: "Hassabis Lab",       handle: "@hardwarelisting", avatar: "🔧", role: "HW news",             url: "" },
    { name: "C.C. Wei",           handle: "",               avatar: "🟦", role: "TSMC CEO",              url: "" },
    { name: "Dr. Ian Buck",       handle: "",               avatar: "🟢", role: "NVIDIA VP CUDA",        url: "" },
    { name: "Raja Koduri",        handle: "@RajaXg",        avatar: "🎨", role: "ex-Intel GPU",          url: "https://x.com/RajaXg" },
  ],

  // ── 한국 (Korean Tech Leaders) — 14명 ────────────────
  korean: [
    { name: "이수안",             handle: "@suanlab",       avatar: "🇰🇷", role: "AI 강의자",              url: "https://x.com/suanlab" },
    { name: "안성진",             handle: "@sungjin_an",    avatar: "📱", role: "삼성 폼팩터",            url: "https://x.com/sungjin_an" },
    { name: "Lilys AI",           handle: "@lilys_ai",      avatar: "🌷", role: "한국 AI SaaS",          url: "https://x.com/lilys_ai" },
    { name: "Toss Tech",          handle: "@toss_tech",     avatar: "💸", role: "토스 엔지니어링",         url: "https://x.com/toss_tech" },
    { name: "Naver Cloud",        handle: "@navercloud",    avatar: "🟢", role: "네이버 클라우드",         url: "https://x.com/navercloud" },
    { name: "Kakao Brain",        handle: "@kakaobrain",    avatar: "🟡", role: "카카오 AI",              url: "https://x.com/kakaobrain" },
    { name: "Upstage",            handle: "@upstageai",     avatar: "🚀", role: "Solar LLM",             url: "https://x.com/upstageai" },
    { name: "Ridge-i",            handle: "@ridge_i_kr",    avatar: "🏔", role: "산업 AI",                url: "https://x.com/ridge_i_kr" },
    { name: "이해진",             handle: "",               avatar: "🌐", role: "네이버 GIO",             url: "" },
    { name: "김범수",             handle: "",               avatar: "💛", role: "카카오 창업자",           url: "" },
    { name: "이승건",             handle: "@toss_seungkun", avatar: "💰", role: "토스 CEO",              url: "" },
    { name: "김기사",             handle: "@gyusangkim",    avatar: "🚗", role: "카카오모빌리티",          url: "" },
    { name: "이상엽",             handle: "@samsung_lee",   avatar: "🔬", role: "삼성리서치",              url: "" },
    { name: "박지원",             handle: "@nexon_park",    avatar: "🎮", role: "넥슨 CEO",              url: "" },
  ],

  // ── Investors / Operators — 10명 ─────────────────────
  investors: [
    { name: "Marc Andreessen",    handle: "@pmarca",        avatar: "🎩", role: "a16z",                  url: "https://x.com/pmarca" },
    { name: "Garry Tan",          handle: "@garrytan",      avatar: "🟧", role: "Y Combinator CEO",      url: "https://x.com/garrytan" },
    { name: "Paul Graham",        handle: "@paulg",         avatar: "📜", role: "YC founder",            url: "https://x.com/paulg" },
    { name: "Naval Ravikant",     handle: "@naval",         avatar: "🌌", role: "AngelList",             url: "https://x.com/naval" },
    { name: "Chamath",            handle: "@chamath",       avatar: "📈", role: "Social Capital",        url: "https://x.com/chamath" },
    { name: "Vinod Khosla",       handle: "@vkhosla",       avatar: "🏁", role: "Khosla Ventures",       url: "https://x.com/vkhosla" },
    { name: "Bill Gurley",        handle: "@bgurley",       avatar: "🦒", role: "Benchmark",             url: "https://x.com/bgurley" },
    { name: "Brad Gerstner",      handle: "@altcap",        avatar: "📊", role: "Altimeter",             url: "https://x.com/altcap" },
    { name: "Sarah Tavel",        handle: "@sarahtavel",    avatar: "🎯", role: "Benchmark",             url: "https://x.com/sarahtavel" },
    { name: "Elad Gil",           handle: "@eladgil",       avatar: "🤖", role: "Solo Capital",          url: "https://x.com/eladgil" },
  ],

  // ── Design Critics — 8명 ─────────────────────────────
  design: [
    { name: "Soleio",             handle: "@soleio",        avatar: "🎨", role: "Combine VC",            url: "https://x.com/soleio" },
    { name: "Julie Zhuo",         handle: "@joulee",        avatar: "📓", role: "Sundial",               url: "https://x.com/joulee" },
    { name: "Brian Lovin",        handle: "@brian_lovin",   avatar: "🌀", role: "Campsite",              url: "https://x.com/brian_lovin" },
    { name: "Tobias van Schneider", handle: "@vanschneider", avatar: "🌒", role: "Semplice",            url: "https://x.com/vanschneider" },
    { name: "Linear",             handle: "@linear",        avatar: "📐", role: "Design lead",           url: "https://x.com/linear" },
    { name: "Refactoring UI",     handle: "@steveschoger",  avatar: "🎯", role: "Tailwind UI",           url: "https://x.com/steveschoger" },
    { name: "Andy Allen",         handle: "@asallen",       avatar: "🍎", role: "Apple design",          url: "https://x.com/asallen" },
    { name: "Meng To",            handle: "@MengTo",        avatar: "🪞", role: "Design+Code",           url: "https://x.com/MengTo" },
  ],

  // ── Security / Privacy — 6명 ─────────────────────────
  security: [
    { name: "Dan Goodin",         handle: "@dangoodin001",  avatar: "🛡", role: "Ars Technica Sec",      url: "https://x.com/dangoodin001" },
    { name: "Brian Krebs",        handle: "@briankrebs",    avatar: "🔐", role: "Krebs on Security",     url: "https://x.com/briankrebs" },
    { name: "Tavis Ormandy",      handle: "@taviso",        avatar: "🎯", role: "Google Project Zero",   url: "https://x.com/taviso" },
    { name: "Matthew Green",      handle: "@matthew_d_green", avatar: "🔒", role: "Cryptographer",      url: "https://x.com/matthew_d_green" },
    { name: "Troy Hunt",          handle: "@troyhunt",      avatar: "🔓", role: "Have I Been Pwned",     url: "https://x.com/troyhunt" },
    { name: "Bruce Schneier",     handle: "@schneierblog",  avatar: "🦅", role: "Schneier on Security",  url: "https://x.com/schneierblog" },
  ],
};

/**
 * 매일 hero에 표시할 24명 선정 (4 columns × 6 rows grid).
 * - 카테고리별로 균형 있게 분포 + 한국 인플루언서 가중.
 * - date string seed로 매일 다른 조합.
 */
window.__INFLUENCERS_DAILY__ = function (dateStr) {
  const groups = window.__INFLUENCERS__ || {};
  const order = [
    "ai_frontier", "ai_research", "devtools", "ax_culture",
    "robotics", "hardware", "korean", "investors", "design", "security",
  ];
  // simple seedable hash
  const seed = String(dateStr || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = [];
  // 각 카테고리에서 2~3명씩 daily-rotation으로 선정
  // korean은 우선순위 가중 (한국 사용자 대상)
  const quotas = {
    ai_frontier: 4, ai_research: 2, devtools: 3, ax_culture: 2,
    robotics: 1, hardware: 2, korean: 4, investors: 3, design: 2, security: 1,
  };
  order.forEach((k) => {
    const arr = groups[k] || [];
    if (!arr.length) return;
    const count = Math.min(quotas[k] || 1, arr.length);
    for (let i = 0; i < count; i++) {
      const idx = (seed + i * 7 + k.length * 3) % arr.length;
      out.push({ ...arr[idx], category: k });
    }
  });
  // dedup by name (혹시 같은 이름이 다른 카테고리에 있으면)
  const seen = new Set();
  return out.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name); return true;
  }).slice(0, 24);
};

/**
 * 전체 인플루언서 수 — UI에서 "전체 N명 추적 중"에 사용.
 */
window.__INFLUENCERS_TOTAL__ = function () {
  const groups = window.__INFLUENCERS__ || {};
  return Object.values(groups).reduce((a, b) => a + (b ? b.length : 0), 0);
};
