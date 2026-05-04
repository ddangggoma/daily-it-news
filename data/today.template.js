/**
 * today.template.js — build-today.js 시드.
 *
 * Round 6: 페르소나 ID 직책 기반으로 변경 (실명 삭제).
 *
 * 자동 생성되지 않는 영역의 fallback:
 *   - quote, lead (null이면 자동 생성)
 *   - influencers — data/influencers.js의 daily-rotation 사용
 *   - insightTemplates — 20명 직책 페르소나 분석 템플릿
 *
 * tag: opportunity / bullish / caution / pattern (insight 카드 색상 분류)
 */
window.__TODAY_TEMPLATE__ = {
  quote: {
    text: "오늘 뉴스가 만든 결정 시계가 가장 중요한 신호다.",
    author: "Daily News Editorial",
    role: "데일리 큐레이션",
    url: "",
  },
  lead: null,
  influencers: [],

  insightTemplates: {
    // 최고경영진
    "chairman":         { tag: "pattern",     titleTemplate: "{topNewsTitle} — 5~10년 포트폴리오 시각",
                          keyQuestion: "이 변화가 5년 후 삼성전자 사업 포트폴리오에서 차지하는 비중은? 지금 인수·투자 결정 옵션은?" },
    "dx-head":          { tag: "opportunity", titleTemplate: "{topNewsTitle} — DX 사용자 경험 통합 관점",
                          keyQuestion: "이 신기술이 1억+ 갤럭시 사용자 경험을 어떻게 바꾸며, 우리는 어느 시점에 통합해야 하는가?" },
    "ds-head":          { tag: "bullish",     titleTemplate: "{topNewsTitle} — DS 메모리·파운드리 영향",
                          keyQuestion: "이 AI 인프라 수요가 우리 HBM·DDR5 로드맵·파운드리 capa 결정에 어떤 영향을 주는가?" },
    // 사업부장
    "mx-head":          { tag: "opportunity", titleTemplate: "{topNewsTitle} — 갤럭시 차세대 차별화",
                          keyQuestion: "이 AI 기능이 갤럭시 다음 세대 단말의 차별화 요소가 될 수 있는가? 온디바이스 vs 클라우드 비중은?" },
    "cmo":              { tag: "pattern",     titleTemplate: "{topNewsTitle} — 글로벌 메시지 전략",
                          keyQuestion: "이 변화를 200개국 사용자에게 어떤 메시지로 전달해야 하며, 차별화 핵심은?" },
    "da-head":          { tag: "bullish",     titleTemplate: "{topNewsTitle} — 가전 IoT/AI ROI",
                          keyQuestion: "이 IoT/AI 변화가 가전 marginal cost를 얼마나 낮추며, 회수 시간선은?" },
    "foundry-head":     { tag: "caution",     titleTemplate: "{topNewsTitle} — 파운드리 고객 확보 영향",
                          keyQuestion: "이 chip 발표가 2nm/3nm 파운드리 고객 확보 경쟁에서 우리에게 유리한가 불리한가?" },
    "lsi-head":         { tag: "opportunity", titleTemplate: "{topNewsTitle} — 시스템 LSI 로드맵 시사점",
                          keyQuestion: "이 ARM/AP 트렌드가 Exynos 다음 세대 로드맵·이미지 센서 차세대 기술에 시사하는 것은?" },
    "vd-head":          { tag: "pattern",     titleTemplate: "{topNewsTitle} — TV/디스플레이 영향",
                          keyQuestion: "이 디스플레이 기술 변화가 TV/모니터 ASP·콘텐츠 생태계에 어떤 영향을 주는가?" },
    "memory-head":      { tag: "bullish",     titleTemplate: "{topNewsTitle} — HBM/CXL 메모리 수요",
                          keyQuestion: "이 AI 학습/추론 트렌드가 HBM4·CXL·LPDDR6 수요 시간선을 어떻게 바꾸는가?" },
    "networks-head":    { tag: "opportunity", titleTemplate: "{topNewsTitle} — 통신 장비 영향",
                          keyQuestion: "이 통신 표준 변화가 5G/6G 장비 수주·Open RAN 채택에 영향을 주는가?" },
    // 기술/연구
    "ds-cto":           { tag: "pattern",     titleTemplate: "{topNewsTitle} — 반도체 R&D 로드맵 시사점",
                          keyQuestion: "이 반도체 기술 변화가 우리 10년 R&D 로드맵·차세대 노드 결정에 시사하는 것은?" },
    "dx-cto":           { tag: "opportunity", titleTemplate: "{topNewsTitle} — DX 부문 단말 통합 시점",
                          keyQuestion: "이 신기술이 갤럭시·TV·가전 중 어느 단말에 먼저 통합되어야 하며, 사업부 간 시너지는?" },
    "biz-support-tf":   { tag: "pattern",     titleTemplate: "{topNewsTitle} — 사업부 시너지 재분배",
                          keyQuestion: "이 변화가 우리 사업부 간 시너지·자원 재분배 우선순위에 어떤 영향을 주는가?" },
    // 지원/거버넌스
    "cfo":              { tag: "caution",     titleTemplate: "{topNewsTitle} — CapEx & ROI 시각",
                          keyQuestion: "이 trend가 향후 3년 CapEx 우선순위와 ROI 회수 시간선에 어떤 영향을 주는가?" },
    "public-affairs":   { tag: "caution",     titleTemplate: "{topNewsTitle} — 정책·규제 영향",
                          keyQuestion: "이 정책/규제 변화가 우리 미국·EU·중국 사업 결정에 어떤 제약·기회를 주는가?" },
    "ma-head":          { tag: "opportunity", titleTemplate: "{topNewsTitle} — M&A pipeline 영향",
                          keyQuestion: "이 발표가 우리가 검토 중인 M&A pipeline의 가치·우선순위를 어떻게 바꾸는가?" },
    // 글로벌/신사업
    "us-ceo":           { tag: "bullish",     titleTemplate: "{topNewsTitle} — 미국 시장 영향",
                          keyQuestion: "이 변화가 미국 시장 channel·통신사 협력·정부 입찰 우선순위에 어떻게 반영되어야 하는가?" },
    "samsung-next":     { tag: "opportunity", titleTemplate: "{topNewsTitle} — Samsung NEXT 투자 후보",
                          keyQuestion: "이 스타트업/기술이 우리 사업부와 PoC 가능한 영역은? 인수 가치는?" },
    "strategy":         { tag: "pattern",     titleTemplate: "{topNewsTitle} — 2-3년 시장 구조 예측",
                          keyQuestion: "이 동향이 2-3년 후 시장 구조에 어떤 영향을 주며, 지금 준비해야 할 카드는?" },
  },
};
