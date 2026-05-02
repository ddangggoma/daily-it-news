---
name: Project Stack — 3-Layer Compound Engineering
description: Daily News 프로젝트는 Superpowers + Gstack + Compound Engineering의 3-layer stack을 사용한다
type: project
---

Daily News는 다음 3-layer stack을 사용합니다:

- **L3 (메타)** — Compound Engineering: `/ce-*` 슬래시 커맨드. 학습 누적·codification.
- **L2 (방법)** — Superpowers: `/brainstorm`, `/write-plan`, `/execute-plan`. TDD + subagent-driven dev.
- **L1 (역할)** — Gstack: `/office-hours`, `/plan-*-review`, `/review`, `/qa`, `/cso`, `/ship`, `/canary`, `/retro` 등 23개+ 가상 엔지니어팀.

**Why:** 사용자가 명시적으로 세 레퍼런스(EveryInc/compound-engineering-plugin, obra/superpowers, garrytan/gstack)를 결합한 환경을 요청. CE 철학("80% 계획·리뷰, 20% 실행, 매 사이클이 다음을 더 쉽게")을 메타-루프로 두고 SP는 척추, gstack은 페르소나로 배치.

**How to apply:** 모든 작업 라우팅은 `.claude/CLAUDE.md`의 의사결정 트리를 따름. 새 작업 시작 시 Strategy phase부터 진입, 종료 시 `/ce-compound` + `/retro`로 학습 기록.
