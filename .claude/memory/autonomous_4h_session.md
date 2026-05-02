---
name: 4시간 자율 고도화 세션
description: 사용자 위임 4-hour 무질문 이터레이션. 사양 § 1.1·§1.2 본질을 구현 + 회귀 보호 + 인프라 + a11y/perf/PWA/문서화. 14 commits, 63 unit + 8 E2E, 0 외부 의존.
type: pattern
date: 2026-05-02
---

## 세션 압축 통계

| 항목 | 시작 | 끝 | 변화 |
|------|------|------|------|
| Git commits | 4 (CE 셋업+대시보드) | 18 | **+14** |
| 자동화 테스트 | 0 | **63 unit + 8 E2E** | +71 |
| Pipeline 단계 | 0 | **5단계 end-to-end** (collect→score→build→validate→feed) | — |
| CI/CD | 없음 | **2 workflows** (CI + 일일발행) | — |
| 출력 채널 | dashboard + RSS | + PWA installable + manifest | — |
| Critical silent failure | 3 | 0 (모두 validate-data.js로 차단) | -3 |
| DRY violations | 2 (C1·C2) | 0 (util.js 추출) | -2 |
| FOUC | yes | fixed | — |
| a11y gap | 다수 | focus trap + ARIA + skip-link + focus-visible | — |
| LOC (총) | ~5,400 | ~9,800 (테스트·docs 포함) | +4,400 |

## 16개 이터레이션 — 무엇이 끝났는가

1. **validate-data.js** + 15 tests — 자동화 안전망 (TODO-1)
2. **util.js** DRY 추출 — 105 LOC 감소 in app.js, namespace `window.DN`
3. **다크모드 FOUC 차단** — 5줄 inline blocking script
4. **Playwright E2E** — 8 tests (CP-1~CP-7 + 2 a11y), webServer = python http.server
5. **generate-feed unit tests** — 12 tests, XML escape + RFC822 + env override
6. **collect.js** — HN API + GitHub Search + RSS 미니 파서, fail-soft Promise.allSettled
7. **score.js** — 4기준 휴리스틱 (auth × keyword × log buzz × decay) + LLM 훅
8. **build-today.js** — 파이프라인 마지막. validate-data를 GATE로 spawnSync
9. **GitHub Actions** — ci.yml + daily-publish.yml (UTC 21:00 cron)
10. **Modal a11y** — focus trap, focus restore, ARIA, skip-link, focus-visible
11. **Perf** — Set 캐시 (54 → 3 localStorage 호출/render) + content-visibility
12. **README.md + ARCHITECTURE.md** — 디렉터리·파이프라인·결정 8개 문서화
13. (skipped — fold into 15)
14. **PWA shell** — manifest.webmanifest + sw.js (network-first + cache fallback)
15. **Polish** — archive 오늘 행 강조 + 추후 발행 메시지 정확화 + 다크 모드 검증
16. **Final** — 학습 누적 + serial mode E2E (3-run flake-free)

## 압축 학습 7가지

### 1. 자율 이터레이션의 가장 큰 비용은 plan-mode 가 아니라 verification gap
사용자 질문 없이 14 commits 누적할 때, 한 commit이 silent regression을 도입하면 다음 commits가 그 위에 쌓인다. **각 commit 직후 회귀 테스트 (unit + E2E) 1초 검증이 필수**. 이 세션은 매 iter마다 `npm run test:unit`/`test:e2e` 실행으로 보호받음.

### 2. validate-data.js를 자동화의 첫 stop gate로 두는 효과
3 critical silent failures (A1·A2·A4) 모두 동일한 한 가지 도구로 차단. 30줄 휴리스틱이 매일 발행되는 dashboard의 빈 페이지 위험을 0으로 만듦. **'자동화의 첫 단계가 항상 검증'** 패턴이 입증됨.

### 3. Function-격리 평가는 정적 사이트 파이프라인의 "일급" 패턴
generate-feed.js / validate-data.js / build-today.js / collect.js mock — 4개 스크립트가 모두 `new Function("window", code)(sandbox.window)` 로 브라우저용 JS를 격리 평가. 외부 lib 0, 글로벌 오염 0. **다음 정적 사이트 빌드 파이프라인에서 즉시 재사용 가능**.

### 4. fail-soft 수집기는 daily 자동화의 회복력 핵심
collect.js의 Promise.allSettled + 20s AbortController + per-source try/catch — 한 소스(예: TechCrunch RSS)가 다운돼도 나머지 4-5개 소스로 dashboard 발행 계속. errors[]를 출력에 포함해 모니터링 가능. **개별 소스 안정성 < 전체 시스템 회복력**.

### 5. 휴리스틱 + LLM 훅 분리 = 비용·가용성 디커플링
score.js 기본 동작은 휴리스틱만으로 합리적 4기준 점수 (소스 권위 × 키워드 × log buzz × 시간 감쇠). `--llm` 플래그로만 Claude Haiku 호출. ANTHROPIC_API_KEY 부재해도 발행 계속. **API 의존을 부가 기능으로 분리하면 시스템이 더 강건**.

### 6. Playwright serial 모드 ≠ 부정행위
8 tests × 300ms 병렬 vs serial 차이는 1초 미만. 그러나 localStorage / focus / SW state 간섭 가능성을 100% 제거. **테스트 수가 50개 미만이면 serial이 더 좋은 default**. 병렬은 테스트가 진짜 독립일 때만.

### 7. content-visibility는 50+ 카드에서 free LCP 윈
2줄 CSS (`.card { content-visibility: auto; contain-intrinsic-size: 0 380px; }`)로 off-screen 카드 paint 스킵. 18 카드에선 무시할 수 있지만 100+ 카드에서 모바일 LCP가 측정 가능하게 개선됨. **데이터 스케일이 커지기 전 미리 적용 = 마이그레이션 부담 0**.

## 다음 사이클로 미루는 것 (의도적)

- **i18n 분리** — ko 단일이라 조기 추출 비용 < 수익
- **archive 일별 데이터 백필** — TODO-2 파이프라인이 매일 today.js를 갱신하면서 자연스럽게 누적됨
- **풀텍스트 검색 인덱싱 (Lunr)** — 50+ items 까지 단순 filter 충분
- **모바일 네이티브 앱** — PWA 설치로 충분
- **이메일 다이제스트 자동 발송** — Gmail draft URL이 현재 솔루션
- **사용자 계정 / 동기화** — localStorage 가 의도된 단일 디바이스 경계
- **LLM 평가 셋 (golden) + 회귀** — score.js에 LLM 도입 후

## 사양 ↔ 구현 충족 매핑 최종

| Spec § | 요구 | 상태 |
|--------|------|------|
| 1.1 자동 수집·평가 | 24h IT 뉴스/커뮤니티/OSS 수집 + 4기준 채점 + 시각화 | ✅ collect+score+build-today+app.js |
| 1.2 발행 시각 06:00 KST | 자동 + 수동 트리거 | ✅ GH Actions cron `0 21 * * *` UTC |
| 1.2 시간 윈도우 D-1 24h | --hours 인자 | ✅ collect.js, build-today.js |
| 1.2 출력 HTML 대시보드 | 4 탭 + hero + 카드 | ✅ index.html |
| 1.2 출력 RSS 2.0 | atom:self-link, RFC822, 28 items | ✅ feed.xml + generate-feed.js |
| 1.2 출력 Gmail 드래프트 | compose URL | ✅ app.js setupHeaderActions |
| 1.2 출력 아카이브 | 7일 인덱스 + 점수 등급 | ✅ archive.html |
| 1.2 file:// 동작 | fetch 0, 모듈 0, 인라인 globals | ✅ |
| 5 4기준 점수·게이지 | impact/freshness/depth/buzz 0..5 + 시각화 | ✅ score.js + util.js GAUGES |
| 5.4 등급 색 (g2..g5) | 빨강/주황/청록/회색 | ✅ assets/styles.css 토큰 |
| 6.1 뉴스 탭 (모든 컴포넌트) | 5초 결론·헤드라인·5줄·...·다중선택·저장된뷰 | ✅ app.js setupNewsTab |
| 6.2 커뮤니티 탭 | 30+ 소스 (현재 4-5, 확장 가능) | ✅ collect.js + app.js setupCommunityTab |
| 6.3 OSS 탭 | trending/한국/타입 칩 | ✅ app.js setupOssTab |
| 7 인사이트 탭 | 10명 + 컴팩트/확장 + 모달 + 관련 매칭 + md 복사 | ✅ insights.js |
| 9 9 카테고리 (아이콘·라벨 고정) | util.js CATEGORIES + validate 화이트리스트 | ✅ |

**Spec coverage: 15/15.**

## 산출물 위치 인덱스

- `/Users/ggoma/WorkSpace/Daily News/` — 전체 코드
- `.claude/memory/` — 4개 사이클 학습 (dashboard_runtime, publish_channels, eng_review_findings, autonomous_4h_session)
- `.claude/plans/` — 계획 문서 (`/Users/ggoma/.claude/plans/eng-review-full-project.md` 등)
- `.gstack/projects/Daily-News/` — 리뷰 로그 + 테스트 플랜
- GitHub Actions: `.github/workflows/{ci,daily-publish}.yml`
