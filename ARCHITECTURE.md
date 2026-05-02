# Architecture

## 시스템 단면

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Daily News 발행 사이클 (24시간)                                          │
│                                                                           │
│  ┌─ T-0h: KST 06:00 GH Actions cron ─────────────────────────────────┐  │
│  │  collect.js → raw-collection.json                                 │  │
│  │     ├─ Hacker News API (top 60, 24h 윈도우)                      │  │
│  │     ├─ GitHub Search (created:>YYYY-MM-DD sort=stars)            │  │
│  │     └─ RSS feeds (TechCrunch, The Verge, Ars Technica)            │  │
│  │  ↓                                                                │  │
│  │  score.js → scored-items.json                                     │  │
│  │     ├─ 휴리스틱: source authority × keyword × log(points)        │  │
│  │     └─ (선택) Claude Haiku LLM 보정                              │  │
│  │  ↓                                                                │  │
│  │  build-today.js → today.js                                        │  │
│  │     ├─ conclusion, fiveLines, stats, buckets, sourceDiversity    │  │
│  │     ├─ insights[] (각 expert × top news)                         │  │
│  │     └─ quote/lead/influencers from today.template.js              │  │
│  │  ↓                                                                │  │
│  │  validate-data.js (GATE — 실패 시 commit 안 됨)                   │  │
│  │  ↓                                                                │  │
│  │  generate-feed.js → feed.xml (RSS 2.0)                            │  │
│  │  ↓                                                                │  │
│  │  npm run test:unit (REGRESSION GATE)                              │  │
│  │  ↓                                                                │  │
│  │  git commit + push → GH Pages 자동 배포                          │  │
│  │  ↓                                                                │  │
│  │  smoke E2E against deployed URL (Playwright CP-1)                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─ 사용자 브라우저 ─────────────────────────────────────────────────┐  │
│  │  index.html ← 정적 페이지, file:// 또는 https://*.github.io/      │  │
│  │  load order:                                                       │  │
│  │    data/today.js     → window.__DAILY__                           │  │
│  │    data/experts.js   → window.__EXPERTS__                         │  │
│  │    data/archive.js   → window.__ARCHIVE__                         │  │
│  │    scripts/util.js   → window.DN     (헬퍼+상수)                  │  │
│  │    scripts/storage.js → window.Storage (localStorage 래퍼)        │  │
│  │    scripts/insights.js → window.Insights (모달, init은 app.js에서) │  │
│  │    scripts/app.js    → window.App + DOMContentLoaded              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

## 모듈 의존 그래프

```
                                     ┌── window.__DAILY__
                                     ├── window.__EXPERTS__
                                     └── window.__ARCHIVE__
                                          ↓
                                       util.js (window.DN)
                                          ↓
                                       storage.js (window.Storage)
                                          ↓
                                       insights.js (window.Insights, no init)
                                          ↓
                                       app.js (window.App, init triggers Insights.init)
                                          ↓
                                       DOMContentLoaded
                                          ├─ renderHero
                                          ├─ setupTabRouter
                                          ├─ setupNewsTab     ──┐
                                          ├─ setupCommunityTab    │ DN.* + Storage.* + DOM
                                          ├─ setupOssTab         │
                                          ├─ setupHeaderActions  │
                                          └─ Insights.init()  ───┘ (App.renderMiniGauges 사용)
```

## 데이터 계약

### `window.__DAILY__` (`data/today.js`)

```ts
{
  date: "YYYY-MM-DD",                         // KST D-1
  generatedAt: "ISO-8601",
  conclusion: { headline, scoreAvg, vs7d },
  counts: { news, community, oss, insights },
  fiveLines: [{ text, anchorId? }],           // 5
  quote: { text, author, role, url },
  lead: string,
  stats: { newsTotal, score45plus, categoriesActive, insights, ... },
  buckets: {
    yesterday: { label, count, active },
    today: ..., archival: ..., all: ...,
  },
  sourceDiversity: [{ region, percent, color }],  // sums 100
  influencers: [{ name, handle, avatar, postExcerpt }],
  news: NewsItem[],
  community: CommunityItem[],
  oss: OssItem[],
  insights: InsightItem[],
}
```

### `NewsItem`

```ts
{
  id: string,                  // 고유, anchor 점프 대상
  title, category, url, source, sourceCountry, summary,
  publishedAt: ISO-8601,
  scores: { impact, freshness, depth, buzz },  // 0..5 each
  tags: string[],
  featured: boolean,           // sum(scores) >= 18
  headline: boolean,           // top by impact+freshness
}
```

### `InsightItem`

```ts
{
  id, expertId,                // expertId ∈ __EXPERTS__.id
  tag: "opportunity" | "pattern" | "caution" | "bullish",
  title, excerpt, keyQuestion,
  analysis: markdown,          // mdToHtml supports # ## ### / **bold** /
                               //                  *italic* / `code` / lists / paragraphs
  relatedNewsIds: string[],    // FK → news[].id (검증됨)
  relatedOssIds: string[],     // FK → oss[].id
  relatedCommunityIds: string[],
}
```

검증 규칙은 `scripts/validate-data.js` 참조. GATE 실패 시 `process.exit 1`.

## 핵심 결정사항

### 1. 외부 의존 0 (정적 사이트)

브라우저 측: fetch / ES modules / CDN / framework 모두 사용 안 함. 모든 데이터는 `<script>` 로 인라인 globals. `file://` 환경에서도 즉시 동작 — 이는 spec § 1.2 강제 조건.

빌드 측: Node std lib + Playwright (dev) 만. `node_modules`는 CI에서만 필요.

### 2. `window.DN` 단일 네임스페이스

`util.js`가 `el`, `$`, `$$`, `escapeHtml`, 점수 헬퍼, 카테고리 상수를 한 객체에 노출. 각 모듈은 `const { ... } = window.DN` 으로 destructure. DRY 보장 + 전역 오염 최소화.

### 3. `Function`-격리 데이터 평가

`generate-feed.js` / `validate-data.js` / `build-today.js` 가 브라우저용 `data/today.js` 를 Node에서 평가할 때 `eval` 대신:

```js
const sandbox = { window: {} };
new Function("window", code)(sandbox.window);
const data = sandbox.window.__DAILY__;
```

격리된 스코프 → globals 오염 없음. 동일 패턴이 미래 멀티-day 백필 (`data/2026-XX-YY.js`)에 그대로 재사용.

### 4. 4기준 채점은 휴리스틱 + LLM 훅

오프라인에서도 합리적 시작값을 내는 휴리스틱 (소스 권위 + 키워드 가중 + 시간 감쇠 + log buzz). LLM 호출은 옵션 (`--llm` 플래그, ANTHROPIC_API_KEY 필요). 실패 시 휴리스틱 fallback.

이는 spec § 1.1 의 "자동 수집·평가" 를 충족하면서 LLM 비용 / API 가용성 / rate limit 의존을 분리.

### 5. 검증 GATE 우선

자동화의 첫 stop gate: `scripts/validate-data.js`. 30줄 휴리스틱이 막을 수 있는 silent failure 패턴 (counts 불일치, 카테고리 화이트리스트 위반, dangling FK, 스코어 범위 초과)을 catch. GH Actions 워크플로에서 commit 전 단계로 GATE.

검증 실패 = 발행 취소. 빈 페이지 publish 위험 0.

### 6. KST 시간 처리

`buildBuckets`은 KST midnight 기준. UTC midnight으로 계산하면 한국 사용자 입장에서 어제·오늘 경계가 09:00 KST가 되어 잘못된 분류. KST = UTC+9 보정 필요.

```js
const kstShift = 9 * 3600 * 1000;
const kstNow = new Date(now.getTime() + kstShift);
const todayKstMidnightUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - kstShift;
```

### 7. localStorage Set 캐시 (perf)

`renderNewsCard`가 카드별로 `Storage.isFlagged` 3회 호출하는 패턴은 18카드 = 54회. `renderNewsGrid` 진입 시 한 번 모든 flag 배열을 Set으로 캐시 → 카드는 Set.has() O(1). 200+ 카드에서 의미 있는 차이.

### 8. 모달 a11y 표준

- 열기 시 `document.activeElement` 저장
- 첫 focusable에 포커스 이동 (RAF 후)
- Tab 트랩 (shift+tab 첫째→마지막, tab 마지막→첫째)
- ESC + 백드롭 닫기 → 저장된 활성 요소로 포커스 복귀
- `aria-pressed` on 토글 버튼

## 확장 포인트

| 무엇 | 어디서 |
|------|--------|
| 새 카테고리 추가 | `util.js` `CATEGORIES` 배열 + `validate-data.js` `CATEGORIES` 화이트리스트 + `collect.js` `CATEGORY_HINTS` |
| 새 소스 추가 | `collect.js` 에 `fetchXxx()` 함수 + `SOURCE_META` 엔트리 |
| 새 전문가 추가 | `data/experts.js` + `data/today.template.js`의 `insightTemplates` |
| 점수 가중치 조정 | `score.js`의 `SOURCE_AUTHORITY` / `IMPACT_KEYWORDS` / `DEPTH_KEYWORDS` |
| 새 출력 채널 | `scripts/`에 generator 추가 + GH Actions 워크플로 단계 추가 |
| LLM 모델 변경 | `score.js`의 `model: "claude-haiku-4-5-..."` 한 줄 |

## 비-범위 (의도적 미구현)

- 다국어 (현재 ko-only, spec 합의)
- 풀텍스트 검색 인덱싱 (Lunr/MiniSearch — 50+ items 까지 단순 filter 충분)
- 사용자 계정 / 서버 측 상태
- 실시간 알림 (RSS reader가 담당)
- 모바일 네이티브 앱 (PWA shell은 향후 후보)
