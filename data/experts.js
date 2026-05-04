/**
 * experts.js — 삼성전자 직책 기반 20인 인사이트 페르소나 (익명화).
 *
 * Round 6 변경사항 (사용자 피드백 "실명 코드명은 모두 삭제하세요"):
 *   1. 모든 실명 (이재용/한종희/전영현/노태문 등) 삭제 → 직책명 사용.
 *   2. ID도 직책 기반 영문 키로 변경 (chairman/dx-head/ds-head 등).
 *   3. 페르소나는 "삼성전자 OO직책 시각"의 fictional 페르소나로 명시.
 *
 * 분석 본문은 build-today.js의 buildInsights에서 자동 생성.
 *
 * 카테고리 분포 (총 20명):
 *   - 최고경영진 (3): 회장 / DX 부회장 / DS 부회장
 *   - 사업부장 (8): MX, CMO, DA, Foundry, LSI, VD, 메모리, Networks
 *   - 기술/연구 (3): DS CTO, DX CTO, 사업지원TF
 *   - 지원/거버넌스 (3): CFO, Public Affairs, M&A
 *   - 글로벌/신사업 (3): SEA CEO, Samsung NEXT, 전사전략
 */
window.__EXPERTS__ = [
  // ────────── 최고경영진 (3) ──────────
  {
    id: "chairman",
    avatar: "👑",
    name: "삼성전자 회장",
    role: "Chairman",
    color: "#1e293b",
    background: "삼성그룹 총수이자 삼성전자 최상위 의사결정권자. 글로벌 기술 패권 경쟁 한가운데에서 5~10년 단위의 사업 포트폴리오 결정을 내린다. 대규모 M&A·CapEx·해외 거점 투자 결정에 관여.",
    sampleQuestion: "이 변화가 5년 후 삼성전자 사업 포트폴리오에서 차지하는 비중은? 지금 결정해야 할 인수·투자 옵션은?",
  },
  {
    id: "dx-head",
    avatar: "🛒",
    name: "DX 부문장",
    role: "DX 부문장 (대표이사 부회장)",
    color: "#0d4d3f",
    background: "TV·생활가전·모바일 전체를 아우르는 DX(Device eXperience) 부문 총괄. AI for All / Bespoke AI 전략 주도. 소비자 가전과 모바일 시너지가 본업이며, 1억+ 사용자의 일상 단말 경험 통합이 핵심 과제.",
    sampleQuestion: "이 신기술이 1억+ 갤럭시 사용자 경험을 어떻게 바꾸며, 우리는 어느 시점에 통합해야 하는가?",
  },
  {
    id: "ds-head",
    avatar: "🔬",
    name: "DS 부문장",
    role: "DS 부문장 (대표이사 부회장)",
    color: "#7c2d12",
    background: "메모리·시스템LSI·파운드리 반도체 사업 전체 총괄. HBM·AI 메모리 경쟁력 회복이 핵심 과제. SK하이닉스와의 HBM 격차, 인텔·TSMC 파운드리 경쟁이 주된 관심사.",
    sampleQuestion: "이 AI 인프라 수요가 우리 HBM·DDR5 로드맵·파운드리 capa 결정에 어떤 영향을 주는가?",
  },

  // ────────── 사업부장 (8) ──────────
  {
    id: "mx-head",
    avatar: "📱",
    name: "MX(모바일) 사업부장",
    role: "MX 사업부장 사장",
    color: "#3b82f6",
    background: "갤럭시 시리즈 총괄. Galaxy AI 전략 (S24부터) 주도. iPhone과의 글로벌 1위 경쟁, 폴더블 시장 선점, 온디바이스 AI 차별화가 본업.",
    sampleQuestion: "이 AI 기능이 갤럭시 다음 세대 단말의 차별화 요소가 될 수 있는가? 온디바이스 vs 클라우드 비중은?",
  },
  {
    id: "cmo",
    avatar: "🎨",
    name: "Global Marketing Office 사장",
    role: "CMO",
    color: "#ec4899",
    background: "삼성전자 글로벌 마케팅 총괄. 갤럭시 Note·Galaxy Unpacked 메시지 전략 주도. Apple 마케팅 정밀도와 경쟁하면서 200개국 시장에 일관 메시지를 전달하는 것이 본업.",
    sampleQuestion: "이 변화를 200개국 사용자에게 어떤 메시지로 전달해야 하며, 경쟁사 대비 차별화 핵심은?",
  },
  {
    id: "da-head",
    avatar: "🏠",
    name: "DA(생활가전) 사업부장",
    role: "DA 사업부장 사장",
    color: "#f59e0b",
    background: "AI 기반 Bespoke 가전, SmartThings 통합 생태계가 본업. LG전자와의 가전 경쟁, 중국 Haier·Midea의 약진에 대응. 재무 안목 기반 ROI 우선 의사결정.",
    sampleQuestion: "이 IoT/AI 변화가 가전 marginal cost를 얼마나 낮추며, ROI 회수 시간선은?",
  },
  {
    id: "foundry-head",
    avatar: "🏭",
    name: "Foundry 사업부장",
    role: "Foundry 사업부장 사장",
    color: "#84cc16",
    background: "TSMC와의 격차 해소가 최대 과제. 2nm GAA, 미국 Texas Taylor Fab 양산, 고객사 다변화(Tesla·Qualcomm·NVIDIA)가 본업. yield 개선과 핵심 고객 확보가 핵심 KPI.",
    sampleQuestion: "이 chip 발표가 2nm/3nm 파운드리 고객 확보 경쟁에서 우리에게 유리한가 불리한가?",
  },
  {
    id: "lsi-head",
    avatar: "🧠",
    name: "System LSI 사업부장",
    role: "System LSI 사업부장 사장",
    color: "#a855f7",
    background: "Exynos AP·이미지 센서·DDI 등 시스템 반도체 총괄. Galaxy 내 Exynos 비중 확대, ISOCELL 이미지 센서 글로벌 점유율 확대가 본업. Qualcomm Snapdragon과의 SoC 경쟁이 핵심.",
    sampleQuestion: "이 ARM/AP 트렌드가 Exynos 다음 세대 로드맵·이미지 센서 차세대 기술에 시사하는 것은?",
  },
  {
    id: "vd-head",
    avatar: "📺",
    name: "VD(영상디스플레이) 사업부장",
    role: "VD 사업부장 사장",
    color: "#06b6d4",
    background: "TV 사업 총괄. Neo QLED·OLED·micro-LED 라인업, Tizen OS 광고 플랫폼, 게이밍 모니터 사업 확장이 본업. Sony·LG의 OLED 공세, TCL·Hisense의 가성비 공세에 양면 대응.",
    sampleQuestion: "이 디스플레이 기술 변화가 TV/모니터 ASP·콘텐츠 생태계에 어떤 영향을 주는가?",
  },
  {
    id: "memory-head",
    avatar: "💾",
    name: "메모리 사업부장",
    role: "메모리사업부장 사장",
    color: "#dc2626",
    background: "DRAM·NAND·HBM 메모리 사업 총괄. SK하이닉스에 빼앗긴 HBM 1위를 되찾기 위해 12-Hi HBM3E·HBM4 양산이 핵심 과제. NVIDIA 인증·CXL·LPDDR6 시장이 다음 전장.",
    sampleQuestion: "이 AI 학습/추론 트렌드가 HBM4·CXL·LPDDR6 수요 시간선을 어떻게 바꾸는가?",
  },
  {
    id: "networks-head",
    avatar: "📡",
    name: "Networks 사업부장",
    role: "Networks 사업부장 사장",
    color: "#0ea5e9",
    background: "5G/6G 통신 장비 사업 총괄. Verizon·AT&T·NTT 등 글로벌 통신사에 5G 장비 공급. 화웨이 제재 반사이익으로 미국·유럽 시장 확대 중. Open RAN, vRAN, 차세대 6G 표준화가 본업.",
    sampleQuestion: "이 통신 표준 변화가 5G/6G 장비 수주·Open RAN 채택에 영향을 주는가?",
  },

  // ────────── 기술 / 연구 (3) ──────────
  {
    id: "ds-cto",
    avatar: "⚗️",
    name: "DS 부문 CTO",
    role: "DS 부문 CTO 사장",
    color: "#6366f1",
    background: "반도체 R&D 총괄. EUV·차세대 GAA 트랜지스터·HBM 패키징 등 10년 시간선의 원천 기술 로드맵을 책임진다. 인텔·TSMC와의 공정 격차 좁히기가 본업.",
    sampleQuestion: "이 반도체 기술 변화가 우리 10년 R&D 로드맵·차세대 노드 결정에 시사하는 것은?",
  },
  {
    id: "dx-cto",
    avatar: "🛰",
    name: "DX 부문 CTO",
    role: "DX 부문 CTO 사장",
    color: "#0891b2",
    background: "DX 부문(TV·생활가전·모바일) 전체의 기술 총괄. AI 통합·SmartThings·On-device LLM·Bixby 차세대·홈 IoT·헬스케어 단말 등 소비자 영역 신기술 도입의 우선순위와 시간선을 결정. 사업부 간 기술 시너지 조율.",
    sampleQuestion: "이 신기술이 갤럭시·TV·가전 중 어느 단말에 먼저 통합되어야 하며, 다른 사업부 시너지는 어떻게 만들 수 있는가?",
  },
  {
    id: "biz-support-tf",
    avatar: "🎯",
    name: "사업지원TF장",
    role: "사업지원TF장 부회장",
    color: "#475569",
    background: "삼성전자 컨트롤타워 격 사업지원TF 총괄. 사업부 간 자원 배분·M&A·인사 정책을 조율. 회장 직속 참모로 전사 시너지·중장기 포트폴리오 결정에 깊이 관여.",
    sampleQuestion: "이 변화가 우리 사업부 간 시너지·자원 재분배 우선순위에 어떤 영향을 주는가?",
  },

  // ────────── 지원 / 거버넌스 (3) ──────────
  {
    id: "cfo",
    avatar: "💰",
    name: "CFO (경영지원실장)",
    role: "CFO",
    color: "#ea580c",
    background: "삼성전자 재무 총괄. CapEx 결정·환율 관리·자사주·배당 정책 책임. 매년 수십조 원 규모의 반도체 투자 결정에서 IRR·NPV 검증이 본업. 글로벌 반도체 cycle에 따른 현금흐름 관리가 핵심.",
    sampleQuestion: "이 trend가 향후 3년 CapEx 우선순위와 ROI 회수 시간선에 어떤 영향을 주는가?",
  },
  {
    id: "public-affairs",
    avatar: "🌏",
    name: "Global Public Affairs팀장",
    role: "Public Affairs Head",
    color: "#84cc16",
    background: "통상·외교 전문가. 미·중 반도체 갈등, 미국 CHIPS Act, EU AI Act, 한국 K-반도체 정책 등 국가 정책·규제와 삼성의 사업 결정을 연결한다. Texas Taylor Fab 인센티브 협상에 깊이 관여.",
    sampleQuestion: "이 정책/규제 변화가 우리 미국·EU·중국 사업 결정에 어떤 제약·기회를 주는가?",
  },
  {
    id: "ma-head",
    avatar: "🤝",
    name: "M&A 담당 사장",
    role: "M&A 전략",
    color: "#9333ea",
    background: "삼성전자 M&A 전략 총괄. Harman 인수(2017, 80억달러) 이후 차세대 M&A 후보 발굴이 본업. AI·자동차전장·헬스케어 영역에서 50조 원 규모의 잠재 M&A를 검토. 미국 antitrust 심사 경험 풍부.",
    sampleQuestion: "이 발표가 우리가 검토 중인 M&A pipeline의 가치·우선순위를 어떻게 바꾸는가?",
  },

  // ────────── 글로벌 / 신사업 (3) ──────────
  {
    id: "us-ceo",
    avatar: "🇺🇸",
    name: "Samsung Electronics America CEO",
    role: "SEA CEO",
    color: "#dc2626",
    background: "북미 시장 총괄. 미국 매출은 삼성전자 글로벌 매출의 30%+. iPhone·Pixel과의 통신사 채널 경쟁, Best Buy·Costco 유통, 미국 정부 입찰(SEER), Texas Fab 운영이 본업.",
    sampleQuestion: "이 변화가 미국 시장 channel·통신사 협력·정부 입찰 우선순위에 어떻게 반영되어야 하는가?",
  },
  {
    id: "samsung-next",
    avatar: "🚀",
    name: "Samsung NEXT 디렉터",
    role: "전략기획 / VC",
    color: "#10b981",
    background: "삼성전자 사내 VC 조직 (Samsung NEXT, 약 5억 달러 AUM). 실리콘밸리·뉴욕·텔아비브 거점에서 AI·SaaS·DevTools·Web3·헬스케어 스타트업에 투자. 삼성 사업부와의 PoC·인수로 연결하는 것이 본업.",
    sampleQuestion: "이 스타트업/기술이 우리 사업부와 PoC 가능한 영역은? 인수 가치는?",
  },
  {
    id: "strategy",
    avatar: "🧭",
    name: "전사 전략기획",
    role: "전사 전략기획팀 부사장",
    color: "#06b6d4",
    background: "전사 중장기 전략·시장 분석·경쟁 동향 모니터링 총괄. 매주 회장 보고용 시장 동향 브리핑을 작성. Apple/Google/Meta/TSMC/SK하이닉스/LG의 동향을 실시간 트래킹하며, 2~3년 후 시장 구조 변화를 예측하는 것이 본업.",
    sampleQuestion: "이 동향이 2-3년 후 시장 구조에 어떤 영향을 주며, 우리가 지금 준비해야 할 카드는?",
  },
];
