# MCP 설정 기본틀 — Windows 10/11 · 프로젝트 폴더 기준

Claude Code / Claude Desktop / Codex / Gemini CLI 네 도구의 MCP 설정 파일을 **프로젝트 폴더에 두는 경우**로 작성한 템플릿입니다.
네 파일 모두 동일한 서버 5종(filesystem / memory / sequential-thinking / playwright / github)을 등록합니다.

## 📁 파일 위치 한눈에 보기

| 도구 | 이 저장소의 파일 | 실제 읽히는 경로 (프로젝트 폴더 기준) | 프로젝트 스코프 지원 |
|---|---|---|---|
| Claude Code (CLI/IDE) | `.mcp.json` | `<프로젝트>\.mcp.json` | ✅ 네이티브 지원 |
| Claude Desktop (앱) | `mcp/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | ❌ 전역만 (복사 필요) |
| Codex | `.codex/config.toml` | `<프로젝트>\.codex\config.toml` | ✅ 네이티브 지원 (신뢰된 프로젝트 한정) |
| Gemini CLI | `.gemini/settings.json` | `<프로젝트>\.gemini\settings.json` | ✅ 네이티브 지원 |

> 🔴 **중요 — Claude Desktop은 프로젝트별 MCP 설정을 지원하지 않습니다.**
> 데스크탑 앱은 `%APPDATA%\Claude\claude_desktop_config.json` **한 곳만** 읽습니다.
> 그래서 이 저장소에는 "프로젝트 폴더에 보관하는 원본"으로 `mcp/claude_desktop_config.json`을 두고,
> 아래 명령으로 실제 위치에 복사해서 씁니다.
> 프로젝트 폴더에서 바로 동작하는 Claude 쪽 설정은 **Claude Code용 `.mcp.json`** 입니다.

---

## 🚀 도구별 적용 방법

### 1. Claude Code — `.mcp.json`
프로젝트 루트에 두면 그대로 인식됩니다. 별도 복사 불필요.

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
claude
# 첫 실행 시 프로젝트 MCP 서버 승인 프롬프트가 뜹니다 → Approve
claude mcp list        # 연결 상태 확인
```

- `${GITHUB_PERSONAL_ACCESS_TOKEN}` 같은 **환경변수 치환을 지원**합니다.
- 승인 상태를 초기화하려면 `claude mcp reset-project-choices`.

### 2. Claude Desktop — `claude_desktop_config.json`

```powershell
# 폴더가 없으면 생성 후 복사
New-Item -ItemType Directory -Force "$env:APPDATA\Claude" | Out-Null
Copy-Item .\mcp\claude_desktop_config.json "$env:APPDATA\Claude\claude_desktop_config.json"
```

- 앱을 **완전히 종료 후 재시작**해야 반영됩니다(트레이 아이콘까지 종료).
- 🔴 **환경변수 치환을 지원하지 않습니다.** `<사용자명>`, 토큰 값을 **실제 문자열로** 바꿔야 합니다.
- 🔴 **상대 경로 불가.** filesystem 서버 인자와 `MEMORY_FILE_PATH`는 반드시 절대 경로(`C:\\...`, 백슬래시 2개)로.
- 로그: `%APPDATA%\Claude\logs\mcp-server-<이름>.log`

### 3. Codex — `.codex/config.toml`
Codex는 **프로젝트 로컬 설정 레이어를 정식 지원**합니다. 별도 환경변수 없이 프로젝트 루트에 두면 됩니다.
현재 작업 폴더(cwd)에서 프로젝트 루트까지 상위 폴더를 훑으며 각 폴더의 `.codex\config.toml`을 병합합니다(깊은 폴더가 우선).

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
codex
# 첫 실행 시 "Do you trust this folder?" → 승인
```

**적용 우선순위** (숫자가 클수록 우선):

```
packaged defaults(-10) < MDM(0) < system(10) < enterprise(15)
  < user  %USERPROFILE%\.codex\config.toml   (20 / 프로필 지정 시 21)
  < ★ project  <프로젝트>\.codex\config.toml  (25)
  < 세션 플래그 --config                        (30)
```

- 🔴 **신뢰된 프로젝트에서만 로드됩니다.** 첫 실행 시 신뢰 프롬프트를 승인하면 **사용자 설정**에 아래가 기록됩니다. 신뢰하지 않으면 이 파일은 에러 없이 조용히 무시됩니다.

  ```toml
  # %USERPROFILE%\.codex\config.toml
  [projects."C:\\Users\\<사용자명>\\WorkSpace\\Daily-News"]
  trust_level = "trusted"
  ```

  `trust_level`은 반드시 **사용자 설정**에 있어야 합니다. 프로젝트 파일에 적어 스스로를 신뢰하게 만들 수는 없습니다.
- 🟠 **프로젝트 레이어에서 무시되는 키가 있습니다** — `model_provider`, `model_providers`, `profile`, `profiles`, `notify`, `openai_base_url`, `chatgpt_base_url`, `otel`, `responses_api_metadata`. 써두면 무시되고 시작 시 경고가 뜹니다. `mcp_servers`는 denylist에 없어 정상 동작합니다.
- 🟡 `CODEX_HOME`은 **사용자 설정 위치**(기본 `%USERPROFILE%\.codex`)를 바꾸는 변수입니다. 프로젝트 설정을 읽히게 하는 용도가 아니므로 건드릴 필요 없습니다.
- 원격 서버는 `url` + `bearer_token_env_var`로 지정합니다(토큰 값이 아니라 **환경변수 이름**). Streamable HTTP는 기본 지원이라 별도 실험 플래그가 필요 없습니다.
- 서버를 잠시 끄려면 해당 블록에 `enabled = false`.

### 4. Gemini CLI — `.gemini/settings.json`
프로젝트 루트의 `.gemini/settings.json`이 사용자 전역 설정(`%USERPROFILE%\.gemini\settings.json`)보다 우선합니다.

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
gemini
/mcp        # 등록된 서버·툴 목록 확인
```

- `$VAR` / `${VAR}` 형태의 **환경변수 치환을 지원**합니다.
- 원격 서버는 `url`(SSE)이 아니라 `httpUrl`(Streamable HTTP) 키를 씁니다.
- `trust: true`로 두면 해당 서버 툴 호출 시 확인 프롬프트를 건너뜁니다(신뢰하는 서버에만).

---

## 🪟 Windows 공통 주의사항

| 항목 | 내용 |
|---|---|
| 🔴 `cmd /c` 래핑 | `npx`/`uvx`는 Windows에서 `.cmd` 셸 스크립트라 직접 spawn하면 `ENOENT`가 납니다. 반드시 `"command": "cmd", "args": ["/c", "npx", ...]` 형태로. |
| 🟠 JSON 백슬래시 | JSON 안의 Windows 경로는 `C:\\Users\\...` 처럼 백슬래시를 2개로. 슬래시(`C:/Users/...`)도 동작합니다. |
| 🟠 Node.js 필요 | `npx` 기반 서버는 Node 20+ 필요. `winget install OpenJS.NodeJS.LTS` |
| 🟡 첫 실행 지연 | `npx -y`는 최초 1회 패키지를 내려받아 30초 이상 걸릴 수 있습니다 → `startup_timeout_sec` / `timeout` 넉넉히. |
| 🟡 경로에 공백 | `C:\Program Files\...` 처럼 공백이 있으면 args 배열의 **한 원소**로 넣습니다(따옴표 추가 불필요). |
| 🔒 토큰 관리 | PAT를 파일에 직접 쓰지 말고 환경변수로: `setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."` (새 터미널부터 적용). Claude Desktop만 예외적으로 직접 입력이 필요합니다. |

## 🔒 커밋 전 확인
`.mcp.json`, `.codex/config.toml`, `.gemini/settings.json`에 **실제 토큰이 들어가지 않았는지** 확인하세요.
로컬에서만 값을 채워 쓰려면 `.gitignore`에 추가하는 것을 권장합니다.

## 📦 등록된 서버 5종

| 서버 | 패키지 | 용도 |
|---|---|---|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | 프로젝트 폴더 읽기/쓰기 (인자로 허용 경로 지정) |
| `memory` | `@modelcontextprotocol/server-memory` | 지식 그래프 기반 장기 메모리 |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | 단계적 추론 보조 |
| `playwright` | `@playwright/mcp` | 브라우저 자동화 · 스크린샷 (이 저장소 E2E 테스트와 연계) |
| `github` | 원격 `api.githubcopilot.com/mcp/` | 이슈·PR·코드 검색 (PAT 필요) |

서버를 빼려면 해당 블록만 삭제하면 됩니다.
