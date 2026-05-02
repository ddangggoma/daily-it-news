// Synthetic broken data for validate-data.js test fixtures.
// Each top-level field violates ONE specific rule the validator enforces.
window.__DAILY__ = {
  date: "2026-05-01",
  generatedAt: "2026-05-02T06:00:00+09:00",
  conclusion: {
    headline: "Broken fixture",
    scoreAvg: "not-a-number",   // ← invalid: not number
    vs7d: 0.5,
  },
  counts: { news: 99, community: 1, oss: 1, insights: 1 }, // ← counts != array length
  fiveLines: [
    { text: "line 1" },
    // only 1 of 5 (warning)
  ],
  quote: { text: "x", author: "a", role: "r", url: "https://example.com" },
  lead: "lead",
  stats: { newsTotal: 1 },
  buckets: { yesterday: { label: "어제", count: 1, active: true } },
  sourceDiversity: [
    { region: "US", percent: 50, color: "#000" },
    { region: "KR", percent: 30, color: "#000" },
    // total 80% (warning)
  ],
  influencers: [],
  news: [
    {
      id: "n01",
      title: "OK item",
      category: "ai",
      url: "https://example.com",
      source: "Source",
      sourceCountry: "US",
      publishedAt: "2026-05-01T22:30:00+09:00",
      summary: "summary",
      scores: { impact: 4.9, freshness: 5.0, depth: 4.6, buzz: 4.8 },
      tags: ["x"],
    },
    {
      id: "n01", // ← duplicate id
      title: "Dup",
      category: "invalid-category", // ← not in whitelist
      url: "ftp://bad",              // ← not http(s)
      source: "S",
      sourceCountry: "X",
      publishedAt: "not-an-iso-date", // ← invalid ISO
      summary: "s",
      scores: { impact: 6, freshness: 4.5, depth: -1, buzz: 4 }, // ← out of range
      tags: ["y"],
    },
  ],
  community: [
    {
      id: "c01", source: "hn", sourceLabel: "HN", sourceColor: "#f60",
      title: "ok", url: "https://example.com", points: 100,
      category: "ai", author: "u",
    },
  ],
  oss: [
    {
      id: "o01", type: "agent", name: "x/y",
      url: "https://example.com", description: "d",
      stars: 100, starsThisWeek: 200, // ← warning: starsThisWeek > stars
      language: "Python",
    },
  ],
  insights: [
    {
      id: "i01",
      expertId: "ghost",       // ← not in __EXPERTS__
      tag: "wrong-tag",        // ← invalid tag
      title: "t",
      excerpt: "e",
      keyQuestion: "q",
      analysis: "## a",
      relatedNewsIds: ["n99"], // ← id not in news[]
      relatedOssIds: [],
      relatedCommunityIds: [],
    },
  ],
};
