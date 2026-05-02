---
name: Eng Review — 전체 프로젝트 사후 감사
description: /plan-eng-review가 commit 0e611e5 시점의 프로젝트 전체에 대해 발견한 16개 이슈, 3 critical gaps, 40+ test gaps. 9개 TODO를 TODOS.md에 큐.
type: pattern
date: 2026-05-02
---

## 압축된 이슈 카테고리

### Critical silent failures (3)
1. **A1 데이터 스키마 검증 0** — `today.js` 1글자 typo가 dashboard 빈 페이지로 직결. 자동화 시작 전 차단 필수.
2. **A3 배포/도메인 미정** — RSS는 만들지만 호스팅 없음. spec § 1.2 미충족.
3. **A4 데이터 수집 파이프라인 0%** — spec § 1.1 핵심 요구. 현재 today.js는 hand-crafted demo.

### DRY violations (사용자 명시 선호 직접 충돌)
- C1: `el`, `$`, `$$`, `escapeHtml` — app.js와 insights.js 양쪽에 정의
- C2: 점수 등급 임계값 — app.js와 archive.html 인라인 양쪽에 하드코딩

### Test coverage 0%
- 자동화 테스트 인프라 없음 (`package.json` 자체 없음)
- Cycle 1·2의 휘발성 manual `preview_eval`만 존재
- T-CRIT (regression): 데이터 shape 검증 — 무조건 다음 사이클 포함

## 압축 학습 5가지 (다음 사이클이 더 쉬워지도록)

### 1. 회고적 리뷰 ≠ 사전 plan 리뷰
`/plan-eng-review`는 forward-looking 사전 plan 리뷰용으로 설계됨. 4 사이클 후 retrospective whole-project audit으로 호출하면 16+ 발견에 대해 개별 AskUserQuestion이 비현실적 (~30 questions). **다음에 retrospective 감사를 할 때는 처음부터 "베이크인 권장안" 형태로 진행하고 strategic decisions만 surface**.

### 2. 데이터 shape 검증은 자동화의 첫 stop gate
정적 사이트 + LLM 점수화 + 매일 갱신 패턴은 **데이터 shape 검증이 없으면 silent breakage가 누적**된다. validate-data.js를 자동화 첫 단계로 두어야 한다. 30줄, 의존 0.

### 3. 단일 페이지 인라인 JS 임계는 ~100줄
`publish_channels.md`의 "50줄 이하 인라인" 가이드는 archive.html이 ~80줄로 모순. 더 정확한 임계: 단일 책임 + 외부 의존 0이면 ~100줄까지 인라인 OK. (TODO-8로 메모리 자체 갱신 큐)

### 4. retrospective 감사에서 베이크인 권장이 가장 빠른 길
사용자가 "전부 정리해줘"라고 할 때, AskUserQuestion 양산 (16 finding × 1 Q = 16 questions) 보다는 (a) 종합 문서 + (b) 핵심 4-5 strategic decisions + (c) 베이크인된 권장 으로 진행. 사용자가 거부하면 그때 변경. **2 round-trip < 16+ round-trips**.

### 5. critical silent failure 패턴 — "에러" vs "내용 없음"
정적 페이지에서 데이터 결손 시 사용자가 보는 것은 "에러"가 아니라 "내용 없음"이다. 빈 게이지(0%), 빈 섹션, 빈 목록 — 모두 silent. 이 패턴이 매일 자동화에 도입되면 실패 한 번이 며칠 갈 수 있다. **항상 자동화 진입 전 validate gate가 있어야 한다.**

## 다음 사이클 베이크인 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| 파이프라인 시작 순서 | TODO-1 (validate) 먼저 | A1·A2 silent failure 차단 — 자동화 안전망 |
| 배포 타겟 | GitHub Pages (main branch root) | 무료, GitOps, 이미 git tracked |
| Outside voice | 스킵 (retrospective) | 다음 forward-looking 계획 때 호출 |
| Playwright 도입 | Lane B 병렬 (TODO-1/2/3와 독립) | 의존 없음 |

## 산출물

- `/Users/ggoma/.claude/plans/eng-review-full-project.md` — 종합 리뷰 문서 (Sections 1-4 + Outputs)
- `/Users/ggoma/.gstack/projects/Daily-News/ggoma-main-eng-review-test-plan-20260502-203757.md` — 테스트 플랜 (페이지/인터랙션/엣지/CP-1..8)
- `/Users/ggoma/.gstack/projects/Daily-News/reviews.jsonl` — 리뷰 로그
- `/Users/ggoma/WorkSpace/Daily News/TODOS.md` — 9 TODOs queued
