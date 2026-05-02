# Daily News — TODOs

이 파일은 `/plan-eng-review` (commit `0e611e5`) 결과로 생성되었습니다. 우선순위 순서대로 작업하세요.

## 다음 사이클 즉시 (Lane A — sequential, scripts/)

### TODO-1 — Data shape regression validator ★ CRITICAL
- **What:** `scripts/validate-data.js` (Node, ~50줄, 의존 0). `data/today.js`를 `Function`-격리 평가 후 schema 검증.
- **Why:** A1·A2 silent failure 차단. 데이터 자동 수집이 시작되면 schema 1글자 오타가 빈 페이지를 발행할 위험.
- **Pros:** 의존 0, pre-commit 또는 pre-publish 훅으로 즉시 활용. 다음 사이클의 안전망.
- **Cons:** 거의 없음 (CC 20분).
- **Validates:**
  - `news[]` 모든 항목: `id, title, category, url, source, sourceCountry, publishedAt, summary, scores, tags`
  - `scores.{impact,freshness,depth,buzz}` 모두 0..5 number
  - `insights[].expertId` 모두 `__EXPERTS__`에 존재
  - `relatedNewsIds[]`의 모든 id가 `news[].id`에 존재 (referential integrity)
  - `counts.news === news.length` 등
- **Effort:** human ~3h / CC ~20min
- **Depends on:** —

### TODO-2 — Data ingestion + 4-criteria scoring pipeline
- **What:** `scripts/collect.js` (RSS feeds + HN API + GitHub trending) + `scripts/score.js` (LLM 4기준 채점) + `scripts/build-today.js` (today.js writer)
- **Why:** spec § 1.1 본질. 현재 0% 구현.
- **Pros:** 매일 자동 갱신. dashboard와 RSS 모두 살아남.
- **Cons:** LLM API 비용 (~$0.01/일 Haiku). 소스 안정성 의존. 첫 구현 후 6개월간 튜닝 필요할 수 있음.
- **Sources to start with:** Hacker News API top 100, GitHub Trending, RSS feeds (techcrunch, the verge, ars, hn weekly digest), Reddit r/programming/r/MachineLearning
- **Effort:** human ~2 days / CC ~1.5h
- **Depends on:** TODO-1 (스키마 검증)

### TODO-3 — GitHub Actions cron + GitHub Pages 배포
- **What:** `.github/workflows/daily-publish.yml`, cron `0 21 * * *` (UTC 21시 = KST 06시), TODO-2 실행 → `node scripts/generate-feed.js` → commit → push → GH Pages 자동 배포
- **Why:** spec § 1.2 자동 발행
- **Pros:** 무료, GitOps 친화적, 변경 이력 보존
- **Cons:** GH Actions cron이 ±15분 지연 가능 (spec의 "06:00 KST"는 "06시 부근"으로 합의)
- **GH Pages config:** Settings → Pages → Source: `main` branch `/` (root)
- **Effort:** human ~4h / CC ~30min
- **Depends on:** TODO-2

## 병렬 가능 (Lane B — independent)

### TODO-4 — E2E happy path (Playwright)
- **What:** `tests/e2e/happy-path.spec.ts` — index.html 로드 → 4탭 → 모달 → ESC. CP-1, CP-2, CP-3 (test plan artifact 참조).
- **Why:** 회귀 보호. TODO-2/3가 매일 today.js를 갱신하기 시작하면 한 번이라도 깨지면 dashboard가 silent로 비어 발행될 위험.
- **Pros:** 5초 내 완료, GH Actions에 통합 쉬움.
- **Cons:** Playwright ~150MB 인스톨, CI 시간 추가.
- **Effort:** human ~4h / CC ~30min
- **Depends on:** —

### TODO-5 — 다크모드 FOUC 제거
- **What:** index.html, archive.html `<head>` 최상단에 inline blocking script 추가
  ```html
  <script>document.documentElement.setAttribute("data-theme", JSON.parse(localStorage.getItem("dn.theme")||'"light"'))</script>
  ```
- **Why:** A6 — 다크모드 사용자가 매 로드마다 흰 깜빡임을 본다.
- **Effort:** human ~5min / CC ~2min
- **Depends on:** —

### TODO-6 — util.js 추출 (DRY 정리)
- **What:** `scripts/util.js` 신설, app.js와 insights.js의 중복 (`el`, `$`, `$$`, `escapeHtml`, `scoreGrade`, CATEGORIES) 추출. archive.html 인라인도 활용.
- **Why:** C1·C2 DRY violation, 사용자 명시 선호.
- **Pros:** ~50 LOC 감소, 카테고리 변경 시 한 곳 수정.
- **Cons:** 파일 1개 추가, 로드 순서 1단계 추가.
- **Effort:** human ~30min / CC ~10min
- **Depends on:** —

### TODO-7 — archive stub 행 명확화 (임시)
- **What:** archive.html disabled 6 행에 "콘텐츠 미발행 — 발행 기록만" 메시지 추가
- **Why:** A5 — 사용자가 클릭해도 무반응 → 혼란
- **Pros:** 즉시 명확
- **Cons:** TODO-2/3 자동 백필되면 무의미 — 임시 가치만
- **Effort:** human ~10min / CC ~3min

## 이후 사이클

### TODO-8 — 학습 메모리 임계값 갱신
- **What:** `.claude/memory/publish_channels.md`의 "단일 페이지 50줄 이하 인라인" 가이드 → "100줄 이하"로 수정. C8.

### TODO-9 — 회귀 테스트 fragile 의존 검증
- **What:** insights.js의 `window.App` fallback 경로 단위 테스트. A8.

## 완료 표시 규칙

- 각 TODO 완료 시 이 파일에서 라인 삭제하지 말고, 헤딩에 `~~취소선~~` + 완료 commit hash 추가:
  - `### ~~TODO-1 — ...~~ ✅ 완료 (commit abc1234)`
- 새 TODO는 우선순위 따라 적절한 섹션에 추가.
- 모든 TODO가 완료되면 이 파일을 통째로 archive: `mv TODOS.md docs/TODOS-archive-2026-XX.md`.
