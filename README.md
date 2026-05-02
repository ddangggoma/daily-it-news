# Daily News

> 어제 24h IT × 4기준 점수 × 10인 분야 전문가 분석

매일 아침 KST 06:00에 발행되는 IT 의사결정자용 정적 대시보드. 어제 24시간 동안의 뉴스·커뮤니티·오픈소스 활동을 자동 수집하고, 4기준 (파급력·시의성·기술도·반응도)으로 평가하며, 10명 분야 전문가 페르소나가 분석합니다.

**스택:** 정적 HTML/CSS/JS만. 서버·DB·번들러 없음. `file://` 또는 GitHub Pages에서 즉시 동작.

## 빠른 시작

```bash
# 1. 클론 후 의존성 설치
npm install

# 2. 로컬 서버 실행
npm run serve  # python3 -m http.server 8765
# 브라우저로 http://localhost:8765
```

또는 `index.html`을 그대로 더블클릭해도 동작합니다 (file:// 모드).

## 명령어

| 스크립트 | 용도 |
|----------|------|
| `npm run validate` | `data/today.js` 데이터 스키마 검증 |
| `npm run feed` | RSS 2.0 (`feed.xml`) 재생성 |
| `npm run test:unit` | 63개 unit 테스트 (validator, scorer, collector, RSS, builder) |
| `npm run test:e2e` | 8개 Playwright E2E 테스트 |
| `npm test` | unit + e2e 통합 |
| `npm run serve` | 로컬 정적 서버 |

## 일일 발행 파이프라인

```
collect.js → score.js → build-today.js → validate-data.js → generate-feed.js
   (sources)  (4기준)    (today.js)       (gate)             (RSS)
```

수동 실행:
```bash
node scripts/collect.js --hours=24
node scripts/score.js
node scripts/build-today.js
npm run feed
```

GitHub Actions가 매일 KST 06:00 (UTC 21:00 cron) 에 동일 시퀀스를 실행하고 GitHub Pages에 배포합니다 (`.github/workflows/daily-publish.yml`).

## 4기준 점수 시스템

각 항목은 4개 차원에서 0~5 실수로 평가됩니다.

| 키 | 한국어 | 의미 |
|----|--------|------|
| `impact` 🎯 | 파급력 | 산업·시장 구조 변화 + 의사결정자 행동 변화 |
| `freshness` ⚡ | 시의성 | 게시 시점 + 1차 보도 여부 + 후속 보도 비율 |
| `depth` 🔬 | 기술도 | 기술 난이도·구현 디테일·재현 가능성·외부 검증 |
| `buzz` 🔥 | 반응도 | 커뮤니티·SNS 반응 + 시간당 증가율 + 즉시 적용성 |

종합 = 4기준 산술 평균. 5점 만점 별점 + 등급 색 (g5 빨강 / g4 주황 / g3 청록 / g2 회색).

## 9 카테고리

🤖 AI / Agent · 🛠 DevTools · 🎯 AX 방법론·문화 · ⚙️ 로봇 · 📺 디스플레이 · 🎨 디자인 · 📄 논문 · ⚖️ 특허/표준 · 📡 통신

## 10인 전문가 페르소나

🔮 파리 (기회 탐지자) · 🧩 메 (패턴 인식가) · 🛡 콜 (회의주의자) · 🗺 아틀라스 (시장 지도제작자) · 🌑 닉스 (엣지 케이스 헌터) · 📈 베가 (강세 thesis) · 📜 세이지 (역사 비교가) · 📡 에코 (커뮤니티 펄스) · 🎨 아이리스 (디자인 비평가) · ⚙️ 오리온 (테크스택 전략가)

## 출력 채널

- **HTML 대시보드:** `index.html` — 4 탭 (뉴스/커뮤니티/오픈소스/인사이트)
- **RSS 2.0:** `feed.xml` — 28+ items (뉴스 + 인사이트)
- **Gmail 드래프트:** 헤더 ✉️ 버튼 (compose URL with summary)
- **아카이브:** `archive.html` — 일자별 발행 기록

## 디렉터리 구조

```
Daily News/
├── index.html              # 메인 대시보드
├── archive.html            # 발행 기록
├── feed.xml                # RSS 2.0 (auto-generated)
├── assets/
│   └── styles.css          # 디자인 토큰 + 컴포넌트
├── data/
│   ├── today.js            # window.__DAILY__ (auto-generated daily)
│   ├── today.template.js   # quote, lead, influencers, insightTemplates 시드
│   ├── experts.js          # 10명 전문가 프로필
│   └── archive.js          # 7일 발행 인덱스
├── scripts/
│   ├── util.js             # 공유 헬퍼 (window.DN)
│   ├── storage.js          # localStorage 래퍼 (별/북마크/읽음/저장된 뷰)
│   ├── insights.js         # 인사이트 카드 + 모달 + 마크다운
│   ├── app.js              # 메인 런타임 (hero, 탭, 필터, 카드)
│   ├── validate-data.js    # 데이터 shape 검증 (CRITICAL gate)
│   ├── generate-feed.js    # RSS 생성기
│   ├── collect.js          # 소스 수집 (HN + GitHub + RSS)
│   ├── score.js            # 4기준 휴리스틱 + LLM 훅
│   └── build-today.js      # 파이프라인 마지막 — today.js writer
├── tests/
│   ├── unit/               # node:test 63개
│   ├── e2e/                # Playwright 8개
│   └── fixtures/           # 합성 데이터
├── .github/workflows/
│   ├── ci.yml              # PR/push 시 unit + e2e
│   └── daily-publish.yml   # 06:00 KST cron
└── ARCHITECTURE.md         # 모듈 의존, 데이터 플로우 상세
```

## 배포 (GitHub Pages)

1. Settings → Pages → Source: **GitHub Actions** 선택
2. (선택) Variables → `DN_SITE_URL`로 커스텀 도메인 지정
3. (선택) Secrets → `ANTHROPIC_API_KEY` 추가 (LLM 점수화 활성화)
4. main에 push → CI 통과 → 자동 배포
5. 매일 06:00 KST `daily-publish` 워크플로 자동 실행

## 개발 워크플로 (Compound Engineering)

이 프로젝트는 [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) 메타-루프 (`/ce-strategy → /ce-plan → /ce-work → /ce-compound`) 위에서 개발됩니다. 자세한 내용은 [.claude/CLAUDE.md](.claude/CLAUDE.md) 참조.

학습은 `.claude/memory/`에 누적됩니다:
- `dashboard_runtime.md` — 런타임 작성 사이클
- `publish_channels.md` — RSS·아카이브 사이클
- `eng_review_findings.md` — 첫 종합 엔지니어링 리뷰

## 사양 / 라이선스

- 사양: 어제 24h IT × 4기준 점수 × 10인 분야 전문가 분석
- 라이선스: MIT (또는 사용자 선호)
- 의존성: Node 20+, Playwright (dev only)
