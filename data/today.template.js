/**
 * today.template.js — build-today.js가 사용하는 시드.
 *
 * 자동 생성되지 않는 영역의 fallback 값:
 *   - quote, lead, influencers, insights[]의 분석 본문
 *
 * LLM 통합 후 일부는 자동 채워짐. 그 전까지는 이 시드로 합리적 출발값 제공.
 */
window.__TODAY_TEMPLATE__ = {
  quote: {
    text: "오늘 뉴스가 만든 결정 시계가 가장 중요한 신호다.",
    author: "Daily News Editorial",
    role: "데일리 큐레이션",
    url: "",
  },
  // lead가 없으면 build-today.js가 counts 기반으로 자동 생성.
  lead: null,

  // 추적 중인 인플루언서 (시드 — 나중에 X/Threads API로 갱신 가능)
  influencers: [
    { name: "Andrej Karpathy", handle: "@karpathy",  avatar: "🧠", postExcerpt: "Agent infra가 표준화되는 순간..." },
    { name: "Dario Amodei",    handle: "@DarioAmodei", avatar: "🔬", postExcerpt: "Computer Use는 진짜 RPA 킬러" },
    { name: "Sam Altman",      handle: "@sama",      avatar: "🚀", postExcerpt: "Agents GA, infra primitive로 자리잡음" },
    { name: "이수안",          handle: "@suanlab",   avatar: "🇰🇷", postExcerpt: "한국 AI SaaS의 글로벌 신호" },
    { name: "Yann LeCun",      handle: "@ylecun",    avatar: "🐱", postExcerpt: "추론 모델은 임시변통이다" },
    { name: "Jim Fan",         handle: "@DrJimFan",  avatar: "🤖", postExcerpt: "휴머노이드는 2026년이 변곡점" },
    { name: "Patrick Collison", handle: "@patrickc", avatar: "💳", postExcerpt: "Stripe Agents가 결제를 재정의" },
    { name: "안성진",          handle: "@sungjin_an", avatar: "📱", postExcerpt: "삼성 폴더블 양산 수율은 게임 체인저" },
  ],

  // 인사이트 분석 본문 placeholder — LLM 통합 후 자동 생성.
  // expertId는 data/experts.js의 id와 매칭. 없으면 build-today.js가 스킵.
  insightTemplates: {
    pari:   { tag: "opportunity", titleTemplate: "{topNewsTitle}가 만든 의사결정 창",
              keyQuestion: "이 발표가 6개월 안의 의사결정을 어떻게 강제하는가?" },
    mae:    { tag: "pattern",     titleTemplate: "{topNewsTitle} — 표준화 사이클의 신호",
              keyQuestion: "이전 인프라 표준화 사이클과 어떤 패턴이 일치하는가?" },
    cole:   { tag: "caution",     titleTemplate: "{topNewsTitle}의 진짜 비용",
              keyQuestion: "마케팅 수치에서 production-ready로 가는 비용은 누가 부담하는가?" },
    atlas:  { tag: "bullish",     titleTemplate: "{topNewsTitle} — 시장 카토그래피",
              keyQuestion: "이 시장이 5년 후 어떤 레이어로 분화될 것인가?" },
    nyx:    { tag: "caution",     titleTemplate: "{topNewsTitle}의 엣지 케이스",
              keyQuestion: "이 시스템이 깨지는 가장 작은 시나리오는?" },
    vega:   { tag: "bullish",     titleTemplate: "{topNewsTitle} 강세 thesis",
              keyQuestion: "이 강세 thesis가 깨지는 첫 번째 신호는?" },
    sage:   { tag: "pattern",     titleTemplate: "{topNewsTitle} — 역사적 변곡점",
              keyQuestion: "역사적으로 어느 변곡점과 가장 닮았는가?" },
    echo:   { tag: "pattern",     titleTemplate: "{topNewsTitle} 커뮤니티 펄스",
              keyQuestion: "지금 커뮤니티 1위가 1~2주 뒤 어떤 결정으로 이어지는가?" },
    iris:   { tag: "opportunity", titleTemplate: "{topNewsTitle} — 디자인 직무 재정의",
              keyQuestion: "이 변화가 디자이너 직무를 어떻게 재정의하는가?" },
    orion:  { tag: "bullish",     titleTemplate: "{topNewsTitle} — 추론 인프라 시간선",
              keyQuestion: "이 발표가 우리 추론·인프라 결정의 시간선을 어떻게 바꾸는가?" },
  },
};
