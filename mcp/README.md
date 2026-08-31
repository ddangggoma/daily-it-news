# MCP 설정 기본틀 — Windows 10/11 · 프로젝트 폴더 기준

Claude, Codex, Gemini CLI 세 도구의 MCP 설정 파일을 **프로젝트 폴더에 두는 경우**로 작성한 템플릿입니다.
세 파일 모두 동일한 서버 5종(filesystem / memory / sequential-thinking / playwright / github)을 등록합니다.

## 📁 파일 위치 한눈에 보기

| 도구 | 이 저장소의 파일 | 실제 읽히는 경로 (프로젝트 폴더 기준) | 프로젝트 스코프 지원 |
|---|---|---|---|
| Claude Code (CLI/IDE) | `.mcp.json` | `<프로젝트>\.mcp.json` | ✅ 네이티브 지원 |
| Claude Desktop (앱) | `mcp/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | ❌ 전역만 (복사 필요) |
| Codex | `.codex/config.toml` | `<프로젝트>\.codex\config.toml` | ⚠️ `CODEX_HOME` 지정 시 |
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
Codex는 `CODEX_HOME`이 가리키는 폴더의 `config.toml`을 읽습니다(기본 `%USERPROFILE%\.codex`).
프로젝트 폴더 설정을 쓰려면 실행 전에 `CODEX_HOME`을 넘겨줍니다.

```powershell
# PowerShell — 이 세션에서만
$env:CODEX_HOME = "$PWD\.codex"
codex
```
```cmd
:: CMD
set CODEX_HOME=%CD%\.codex && codex
```

- `experimental_use_rmcp_client = true` 는 **원격(HTTP) MCP 서버를 쓸 때만** 필요합니다.
- 토큰은 값이 아니라 **환경변수 이름**을 `bearer_token_env_var`로 지정합니다.
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
`.mcp.json`, `.gemini/settings.json`, `.codex/config.toml`에 **실제 토큰이 들어가지 않았는지** 확인하세요.
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
