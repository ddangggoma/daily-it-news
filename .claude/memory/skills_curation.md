---
name: Skills + Agents 큐레이션 — Daily News 컨텍스트
description: 97 skills + 49 agents 중 정적 JS/HTML/CSS + Node 파이프라인 + GH Pages + 한국어 컨텍스트에서 즉시 가치 있는 것만 추린 운용 가이드
type: reference
date: 2026-05-03
---

## 매번 사용 (TOP 5)

1. **`/ce-code-review`** — 매 PR / 변경 직후. 내부적으로 4-6 reviewer agent 자동 디스패치.
2. **`/ce-plan` + `/plan-eng-review`** — 새 기능 시작. CE는 WHY, gstack은 아키텍처 락.
3. **`/ce-compound`** — 작업 종료. `.claude/memory/`에 학습 누적 → 다음 사이클 쉬워짐.
4. **`ce-best-practices-researcher`** (Agent) — 외부 표준·모범사례 필요할 때.
5. **`/benchmark` + `/cso`** — 출하 직전 게이트.

## 라이프사이클 단계별 (Daily News 적용)

| 단계 | 우선 | 보조 |
|------|------|------|
| Strategy | `/ce-strategy` | `/office-hours` |
| Research | `ce-best-practices-researcher` · `ce-framework-docs-researcher` · `ce-learnings-researcher` | `ce-web-researcher` · `ce-session-historian` |
| Plan | `/ce-plan` · `/plan-eng-review` | `/plan-design-review` (UI 변경 시) · `/plan-devex-review` |
| Build | `/execute-plan` (TDD) · `/ce-work` | SP `subagent-driven-development` |
| Review | `/ce-code-review` | `/review` (gstack staff eng) · `/codex` (독립 OpenAI) |
| QA | `/qa` · `/benchmark` · `/cso` | `/qa-only` (코드 변경 없이) · `/devex-review` |
| Ship | `/ship` · `/land-and-deploy` · `/canary` | `/ce-commit-push-pr` · `/document-release` |
| Reflect | `/ce-compound` · `/retro` | `/ce-session-extract` |
| Debug(횡단) | `/ce-debug` · `/investigate` | SP `systematic-debugging` |

## 도메인 특화 적용

| 슬래시 / Agent | Daily News 시나리오 |
|---------------|---------------------|
| `ce-julik-frontend-races-reviewer` | 모달 / 필터 디바운스 / SW 변경 시 |
| `ce-performance-reviewer` | Storage 캐시 / content-visibility / DOM 배치 |
| `ce-reliability-reviewer` | collect.js fail-soft / sw.js timeout / cron drift |
| `ce-security-reviewer` | RSS 공개 + GH Pages 공개 사이트 |
| `/ce-frontend-design` | 다크 테마 토큰 / 카테고리 컬러 |
| `/ce-simplify-code` | app.js 1500줄 넘으면 분할 검토 |
| `/ce-optimize` | RUM 데이터 들어온 뒤 |
| `ce-deployment-verification-agent` | GH Actions 배포 게이트 강화 |

## 도메인 불일치 — 호출 금지

Rails / Python heavy / Swift / DB migrations / 브라우저 자동화 / 메타 셋업 도구는 이 프로젝트에 무관:

- ce-dhh-rails-* · ce-kieran-rails-* (Rails)
- ce-kieran-python-reviewer (Python heavy 코드 0)
- ce-swift-ios-reviewer · ce-test-xcode (Swift/iOS)
- ce-data-integrity-guardian · ce-data-migrations-reviewer · ce-schema-drift-detector · ce-data-migration-expert (DB 마이그레이션)
- ce-api-contract-reviewer (진정한 API endpoint 없음)
- connect-chrome · browse · setup-browser-cookies · pair-agent (Playwright로 충분)
- make-pdf · ce-gemini-imagegen · ce-demo-reel (사양에 없음)
- skillify · gstack-upgrade · setup-deploy · setup-gbrain (이미 셋업됨)
- benchmark-models (ML 모델 벤치 — 우리 LLM 호출 1회만)

## 호출 패턴

```bash
# 슬래시 — 메인 채팅에서 직접
/ce-code-review scripts/score.js
/ce-plan "LLM 점수화 도입"

# Agent (Claude Code Agent tool)
Agent type: ce-best-practices-researcher
Prompt: "GitHub Actions cron jitter — production consensus on retry
        strategy when 0 21 * * * runs at 21:14 UTC. 200 words with
        3 concrete alternatives."

# 병렬 디스패치 (한 메시지에 여러 Agent)
# - ce-framework-docs-researcher (Playwright)
# - ce-web-researcher (경쟁 대시보드)
# - ce-best-practices-researcher (RSS 2.0 modern caveats)
# → 3분 안에 3개 관점

# /loop 자율 루프
/loop 30m /ce-product-pulse        # 30분마다 펄스
```

## CE 원칙: 메모리 우선 검색

새 작업 시작 시 **항상**:
```
Agent ce-learnings-researcher:
  ".claude/memory/ 검색 — 이번 작업에 적용 가능한 학습 5개 이내."
```
현재 누적된 메모리 (5개):
- `dashboard_runtime.md` — 런타임 작성 사이클 학습
- `publish_channels.md` — RSS·아카이브 사이클
- `eng_review_findings.md` — 첫 종합 엔지니어링 리뷰
- `autonomous_4h_session.md` — 4시간 자율 14-commit 세션
- `skills_curation.md` — 본 문서

## 다음 사이클 추천 시퀀스 4종

### A. 데이터 파이프라인 production화
`/ce-strategy → ce-best-practices-researcher → /plan-eng-review → /ce-plan → /execute-plan + TDD → /ce-code-review → /qa + /benchmark + /cso → /ship → /land-and-deploy → /canary → /ce-compound + /retro`

### B. UI 다듬기 (다크 모드·시각 일관성)
`/ce-frontend-design → /design-shotgun → /plan-design-review → /design-html → /design-review → /benchmark`

### C. 신뢰성·운영 강화
`ce-reliability-reviewer → ce-deployment-verification-agent → /canary → /investigate`

### D. 보안 / 개인정보
`/cso → ce-security-reviewer → ce-security-sentinel`
