# Compound Engineering Stack — 부트스트랩

새 환경에서 이 프로젝트의 Claude 셋업을 재현하려면:

## 사전 요구사항

- macOS / Linux, zsh 또는 bash
- Git
- Node 20+ (선택)
- Bun (gstack 런타임)

## 부트스트랩 (4단계)

```bash
# 1. Bun 설치 (없을 때만)
command -v bun >/dev/null 2>&1 || curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 2. 세 vendor repo clone
mkdir -p .claude/vendor
cd .claude/vendor
git clone --depth 1 https://github.com/obra/superpowers.git
git clone --depth 1 https://github.com/EveryInc/compound-engineering-plugin.git
cd ..
mkdir -p skills
git clone --depth 1 https://github.com/garrytan/gstack.git skills/gstack

# 3. gstack 셀프-셋업 (skills 등록)
cd skills/gstack
./setup --host claude --team --no-prefix --quiet
cd ../..

# 4. SP + CE symlink 생성
bash bin/setup-symlinks.sh
```

## 검증

```bash
# 각 레이어 카운트
echo "SP skills:    $(find skills -maxdepth 1 -type l -lname '*superpowers*' | wc -l)"
echo "CE skills:    $(find skills -maxdepth 1 -type l -lname '*compound-engineering*' | wc -l)"
echo "Gstack skills: $(find skills -maxdepth 2 -type l -name SKILL.md -lname '*skills/gstack/*' | wc -l)"
echo "Total agents:  $(ls -1 agents | wc -l)"
echo "Total cmds:    $(ls -1 commands | wc -l)"
```

기대값: SP 14, CE 38, Gstack 45+, agents 50, commands 3.

## 갱신

```bash
cd .claude/vendor/superpowers && git pull
cd ../compound-engineering-plugin && git pull
cd ../../skills/gstack && git pull && ./setup --host claude --team --no-prefix --quiet
cd ../.. && bash bin/setup-symlinks.sh   # SP/CE 새 skills 노출
```

## 문제 해결

**`bun not found`** → `export PATH="$HOME/.bun/bin:$PATH"`를 셸 rc에 추가

**gstack `./setup`가 멈춘다** → `--quiet` 빼고 `./setup --host claude --team --no-prefix` 로 진행상황 확인. team-init 단계가 git 작업 대기 중일 수 있음.

**broken symlinks** → 원본 vendor가 사라지거나 위치가 바뀜. `bin/setup-symlinks.sh` 재실행으로 재생성.

**slash command가 안 보임** → 새 Claude Code 세션 재시작. `.claude/skills/<name>/SKILL.md` 존재 확인.
