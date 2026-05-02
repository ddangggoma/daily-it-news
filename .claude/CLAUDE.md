# Daily News — Compound Engineering Stack

이 프로젝트는 세 가지 레퍼런스를 통합한 Claude Code 환경입니다. **Compound Engineering 철학을 메타-루프로 두고, Superpowers를 방법론 척추로, Gstack을 역할별 페르소나로 배치**합니다.

## 3-Layer Stack

```
┌────────────────────────────────────────────────────────────┐
│  L3 — Compound Engineering (Meta-loop, 학습 누적)         │
│  /ce-strategy /ce-ideate /ce-brainstorm /ce-plan          │
│  /ce-work /ce-debug /ce-code-review /ce-compound          │
│  → 매 사이클의 학습이 다음 사이클을 더 쉽게 만든다       │
├────────────────────────────────────────────────────────────┤
│  L2 — Superpowers (Methodology backbone)                  │
│  /brainstorm /write-plan /execute-plan                    │
│  TDD · systematic-debugging · verification-before-comp.   │
│  Subagent-driven dev · git-worktrees                      │
├────────────────────────────────────────────────────────────┤
│  L1 — Gstack (Virtual engineering team — 페르소나)       │
│  /office-hours /plan-ceo-review /plan-design-review       │
│  /plan-eng-review /plan-devex-review                      │
│  /review /cso /qa /benchmark /devex-review                │
│  /ship /land-and-deploy /canary /retro /investigate       │
└────────────────────────────────────────────────────────────┘
```

## 핵심 철학: Compound Engineering (L3)

> "Each unit of engineering work should make subsequent units easier — not harder."
> — 80% 계획·리뷰, 20% 실행

모든 작업은 **닫힌 루프**여야 합니다. 작업 시작 전에 학습된 것을 활용하고, 작업 종료 시 학습을 codify합니다. 이 사이클을 반복할수록 같은 종류의 작업이 점점 쉬워집니다.

**의무 규칙:**
1. 모든 새 작업은 `/ce-strategy` 또는 STRATEGY.md 검토로 시작 (있다면).
2. 모든 작업은 `/ce-compound` 또는 `/retro`로 종료 — 학습을 메모리에 기록.
3. `/execute-plan` 또는 `/ce-work` 시작 전 반드시 `/write-plan` 또는 `/ce-plan` 산출물 필요.

## 라이프사이클 매핑

| Phase     | L3 CE (메타)       | L2 Superpowers (방법)   | L1 Gstack (역할)                          |
|-----------|--------------------|--------------------------|-------------------------------------------|
| Strategy  | `/ce-strategy`     | —                        | `/office-hours` (PM 인터로게이션)         |
| Ideate    | `/ce-ideate`       | `/brainstorm`            | `/plan-ceo-review` (10-star 재구상)       |
| Design    | —                  | —                        | `/plan-design-review` `/design-shotgun`   |
| Plan      | `/ce-plan`         | `/write-plan`            | `/plan-eng-review` `/plan-devex-review`   |
| Build     | `/ce-work`         | `/execute-plan` (TDD)    | —                                         |
| Review    | `/ce-code-review`  | requesting-code-review   | `/review` (Staff Eng) `/cso` (보안)       |
| QA        | —                  | verification-before-comp.| `/qa` `/benchmark` `/devex-review`        |
| Ship      | —                  | finishing-a-branch       | `/ship` `/land-and-deploy` `/canary`      |
| Reflect   | `/ce-compound`     | —                        | `/retro`                                  |
| Debug(횡단) | `/ce-debug`     | systematic-debugging     | `/investigate` (가설-기반 RCA)            |

## 상황별 라우팅 (의사결정 트리)

### 새 기능 시작
```
/ce-strategy → /office-hours → /ce-brainstorm → /plan-ceo-review
→ /ce-plan + /write-plan → /plan-eng-review → (UI면 /plan-design-review)
→ /execute-plan → /review + /cso → /qa + /benchmark
→ /ship → /canary → /ce-compound + /retro
```

### 버그 수정
```
/ce-debug → /investigate (가설 수립) → /write-plan (재현 + 픽스)
→ /execute-plan → /review → /qa → /ship → /ce-compound
```

### 빠른 한 줄 수정
```
/ce-work (단순 fix) → /review → 커밋
끝에서 한 줄이라도 /ce-compound로 학습 기록
```

### 디자인 탐색
```
/design-consultation (시스템 검토) → /design-shotgun (4-6 변형)
→ /plan-design-review (10점 채점 + AI 결함 탐지)
→ /design-html (프로덕션 HTML)
```

## 우선순위 (이름 충돌 시)

세 소스가 같은 컨셉을 다른 이름으로 노출할 수 있습니다. **메타가 방법보다, 방법이 역할보다 우선**:

- `/ce-brainstorm` (L3) > `/brainstorm` (L2) — CE는 STRATEGY.md와 연결됨
- `/ce-plan` (L3) ≈ `/write-plan` (L2) — 함께 사용 (CE: WHY, SP: 2-5분 단위 태스크)
- `/ce-debug` (L3) + `/investigate` (L1) — CE는 메타 흐름, gstack은 가설-기반 RCA

## 핵심 슬래시 커맨드 인덱스

### L3 — Compound Engineering (`ce-*`)
- `/ce-strategy` — STRATEGY.md 작성/유지
- `/ce-ideate` — 큰 그림 아이디어 생성·평가
- `/ce-brainstorm` — 인터랙티브 요건 문서화
- `/ce-plan` — 아이디어를 구현 계획으로
- `/ce-work` — 계획 실행 + 작업 추적
- `/ce-debug` — 실패 재현·픽스
- `/ce-code-review` — 멀티-에이전트 리뷰
- `/ce-compound` — 학습 codify (가장 중요!)
- `/ce-product-pulse` — 시간창 기반 사용·성능 리포트
- `/ce-setup` — 프로젝트 부트스트랩

### L2 — Superpowers (방법론)
- `/brainstorm` — 아이디어 정제
- `/write-plan` — 2-5분 단위 태스크로 계획
- `/execute-plan` — 서브에이전트 디스패치 + 2단계 리뷰

### L1 — Gstack (역할별 페르소나)
- `/office-hours` — PM 강제 질문
- `/plan-ceo-review` — 10-star 재구상
- `/plan-design-review` — UX 0-10 채점
- `/plan-eng-review` — 아키텍처·데이터 플로우 락
- `/plan-devex-review` — DX 검토
- `/review` — Staff Engineer 리뷰 + auto-fix
- `/qa` — QA + 회귀 테스트
- `/qa-only` — 코드 변경 없이 버그 문서화
- `/cso` — OWASP + STRIDE 위협 모델링
- `/benchmark` — Core Web Vitals 베이스라인
- `/devex-review` — 온보딩 플로우 측정
- `/investigate` — 가설-기반 RCA
- `/ship` — PR 오픈
- `/land-and-deploy` — 머지 + 프로덕션 검증
- `/canary` — 배포 후 모니터링
- `/document-release` — 문서 자동 갱신
- `/retro` — 주간 회고 + 인분석
- `/codex` — OpenAI 독립 리뷰

## 메모리 정책

이 프로젝트의 학습은 두 곳에 누적됩니다:

1. **글로벌**: `/Users/ggoma/.claude/projects/-Users-ggoma-WorkSpace-Daily-News/memory/` — Claude의 어시스턴트 메모리 (auto memory 시스템)
2. **로컬**: `.claude/memory/` — 프로젝트별 CE compound learnings (수동 관리)

`/ce-compound` 호출 시 **양쪽 모두**에 의미 있는 학습 기록.

## 벤더 디렉터리

세 레퍼런스 repo의 원본은 `.claude/vendor/`에 clone되어 있고, `.gitignore`로 부모 git에서 제외됩니다.

```
.claude/vendor/
├── superpowers/                       (github.com/obra/superpowers)
└── compound-engineering-plugin/       (github.com/EveryInc/compound-engineering-plugin)

.claude/skills/gstack/                 (github.com/garrytan/gstack — setup 정책상 skills 하위)
```

업데이트:
```bash
cd .claude/vendor/superpowers && git pull
cd .claude/vendor/compound-engineering-plugin && git pull
cd .claude/skills/gstack && git pull && ./setup --host claude --team --no-prefix --quiet
```

## 부트스트랩 검증

새 환경에서 동일 셋업을 재현하려면 `.claude/SETUP.md`를 참조 (스크립트화될 예정). 현재 의존성:
- Bun (gstack 런타임): `~/.bun/bin/bun` — `curl -fsSL https://bun.sh/install | bash`
- Git, Node 20+, zsh
