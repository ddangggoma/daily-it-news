---
name: Reference Repos — vendor 디렉터리
description: 3-layer stack의 원본 repo 위치, 업데이트 방법, 각각이 제공하는 것
type: reference
---

세 원본 repo는 `.claude/vendor/`에 shallow clone되어 있고 `.gitignore`로 부모 git에서 제외됩니다.

| Layer | Repo | 위치 | 제공 |
|-------|------|------|------|
| L3 (메타) | [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) | `.claude/vendor/compound-engineering-plugin/plugins/compound-engineering/` | 38 skills (`ce-*`), 49 agents |
| L2 (방법) | [obra/superpowers](https://github.com/obra/superpowers) | `.claude/vendor/superpowers/` | 14 skills, 1 agent (code-reviewer), 3 commands, 4 hooks |
| L1 (역할) | [garrytan/gstack](https://github.com/garrytan/gstack) | `.claude/skills/gstack/` (setup 정책상 vendor가 아닌 skills 하위) | 60+ skill 디렉터리 (가상 엔지니어팀 페르소나) |

**업데이트 명령:**
```bash
cd .claude/vendor/superpowers && git pull
cd .claude/vendor/compound-engineering-plugin && git pull
cd .claude/skills/gstack && git pull && ./setup --host claude --team --no-prefix --quiet
```

**Bun 의존성:** gstack과 CE 모두 Bun 사용 가능 (CE는 bun.lock 보유). 셸에 `export PATH="$HOME/.bun/bin:$PATH"` 추가됨.

**원본 변경 추적:** vendor/ 내부는 nested git repo. `.gitignore`로 부모 트래킹 제외 — 변경사항은 각 vendor에서 git 명령으로 직접 관리.
