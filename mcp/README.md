# MCP 설정 기본틀 — Windows 10/11 · 프로젝트 폴더 기준

Claude Desktop / Codex / Gemini CLI 세 도구의 MCP 설정 템플릿입니다.
**"프로젝트 폴더 내 설정이 정말 동작하는가"를 각 도구의 공식 가이드와 오픈소스 구현으로 검증**한 결과를 반영했습니다.

## ✅ 검증 결과 요약

| 도구 | 프로젝트 로컬 설정 | 파일 경로 (프로젝트 기준 상대 경로) | 근거 |
|---|---|---|---|
| **Codex** (앱/IDE/CLI) | ✅ **정식 지원** | `.codex/config.toml` | `openai/codex` — `ConfigLayerSource::Project` (precedence 25) |
| **Gemini CLI** | ✅ **정식 지원** | `.gemini/settings.json` | `google-gemini/gemini-cli` — `Storage.getWorkspaceSettingsPath()` |
| **Claude Desktop** | ❌ **미지원 (전역 전용)** | `mcp/claude_desktop_config.json` → 전역 경로로 복사 | 전역 `claude_desktop_config.json` 한 곳만 로드 |

> 🔴 **Claude Desktop만 프로젝트 로컬 설정을 지원하지 않습니다.**
> 데스크탑 앱은 작업 폴더(working directory) 개념 자체가 없어 전역 설정 한 곳만 읽습니다.
> 따라서 프로젝트에는 **원본만 보관**하고, 배포 스크립트로 전역 경로에 복사해 씁니다.
> 참고로 **Claude Code**(CLI/IDE)는 프로젝트 로컬 `.mcp.json`을 정식 지원하며, 이 저장소 루트에 함께 두었습니다.

---

## 1️⃣ Claude Desktop — `mcp/claude_desktop_config.json` ❌ 전역 전용

**프로젝트 내 보관 위치**: `mcp/claude_desktop_config.json`
**실제로 읽히는 위치** (둘 중 설치 형태에 따라):

| 설치 형태 | 경로 |
|---|---|
| 일반 설치 (.exe) | `%APPDATA%\Claude\claude_desktop_config.json` |
| MSIX / Microsoft Store | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |

🟠 앱 내 **"Edit Config" 버튼이 MSIX 설치본에서 엉뚱한 파일을 여는 알려진 버그**가 있습니다. 편집했는데 서버가 안 뜨면 위 두 경로를 직접 확인하세요.

**배포** — 경로 자동 판별 + 백업 + 프로젝트 절대 경로 치환까지 처리하는 스크립트를 함께 넣었습니다:

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp\install-claude-desktop-config.ps1
```

수동으로 하려면:
```powershell
New-Item -ItemType Directory -Force "$env:APPDATA\Claude" | Out-Null
Copy-Item .\mcp\claude_desktop_config.json "$env:APPDATA\Claude\claude_desktop_config.json"
```

- 🔴 **환경변수 치환 미지원** — `<사용자명>`과 토큰을 **실제 문자열로** 직접 입력해야 합니다.
- 🔴 **상대 경로 불가** — filesystem 인자와 `MEMORY_FILE_PATH`는 절대 경로(`C:\\...`, 백슬래시 2개).
- 🟡 원격 MCP는 stdio 프록시(`mcp-remote`)를 거칩니다. 설정 파일이 HTTP 트랜스포트를 직접 받지 않기 때문입니다.
- 반영하려면 **트레이 아이콘까지 완전히 종료 후** 재시작.
- 로그: `%APPDATA%\Claude\logs\mcp-server-<이름>.log`

---

## 2️⃣ Codex — `.codex/config.toml` ✅ 정식 지원

**위치**: `.codex/config.toml` (프로젝트 루트 기준)

`CODEX_HOME` 같은 환경변수 없이 그대로 동작합니다. Codex는 cwd에서 프로젝트 루트까지 상위 폴더를 훑으며 각 폴더의 `.codex\config.toml`을 병합합니다(깊은 폴더가 우선). CLI·IDE 확장·데스크탑 앱이 같은 `app-server` 백엔드를 쓰므로 **셋 다 동일하게 적용**됩니다.

**적용 우선순위** (`ConfigLayerSource::precedence()`):

```
packaged defaults(-10) < MDM(0) < system(10) < enterprise(15)
  < user  %USERPROFILE%\.codex\config.toml   (20 / 프로필 지정 시 21)
  < ★ project  <프로젝트>\.codex\config.toml  (25)
  < 세션 플래그 --config                        (30)
```

🔴 **전제조건 — 프로젝트가 "신뢰됨"이어야 로드됩니다.** 해당 폴더에서 Codex를 처음 실행하면 "Do you trust this folder?" 프롬프트가 뜨고, 승인하면 **사용자 설정**에 기록됩니다:

```toml
# %USERPROFILE%\.codex\config.toml
[projects."C:\\Users\\<사용자명>\\WorkSpace\\Daily-News"]
trust_level = "trusted"
```

신뢰하지 않으면 이 파일은 **에러 없이 조용히 무시**됩니다(앱에서는 경고 알림이 뜹니다). `trust_level`은 반드시 사용자 설정에 있어야 하며, 프로젝트 파일에 적어 스스로를 신뢰하게 만들 수는 없습니다.

- 🟠 **프로젝트 레이어에서 무시되는 키** (`PROJECT_LOCAL_CONFIG_DENYLIST`) — `model_provider`, `model_providers`, `profile`, `profiles`, `notify`, `openai_base_url`, `chatgpt_base_url`, `otel`, `responses_api_metadata`, `apps_mcp_product_sku`, `experimental_realtime_*`. 써두면 무시되고 시작 시 경고가 뜹니다. **`mcp_servers`는 denylist에 없어 정상 동작합니다.**
- 🟡 `CODEX_HOME`은 **사용자 설정 위치**를 바꾸는 변수일 뿐, 프로젝트 설정과 무관합니다.
- 원격 서버는 `url` + `bearer_token_env_var`(토큰 값이 아니라 **환경변수 이름**). Streamable HTTP가 기본 지원이라 별도 실험 플래그가 필요 없습니다.
- 서버를 잠시 끄려면 해당 블록에 `enabled = false`.

---

## 3️⃣ Gemini CLI — `.gemini/settings.json` ✅ 정식 지원

**위치**: `.gemini/settings.json` (프로젝트 루트 기준)

`Storage.getWorkspaceSettingsPath()`가 `<작업 폴더>/.gemini/settings.json`을 반환합니다. 전역 설정(`%USERPROFILE%\.gemini\settings.json`)과 **shallow merge**되며, 같은 이름의 서버는 프로젝트 설정이 이깁니다.

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
gemini
/mcp        # 등록된 서버·툴 목록 확인
```

- ✅ **환경변수 치환 지원** — `$VAR`, `${VAR}`, 기본값 문법 `${VAR:-기본값}`까지 됩니다.
- 🟠 **`httpUrl`은 deprecated** — 원격 서버는 `url` + `type: "http"` 조합을 쓰세요(이 템플릿은 새 문법 적용). SSE는 `type: "sse"`.
- `trust: true`로 두면 해당 서버 툴 호출 시 확인 프롬프트를 건너뜁니다(신뢰하는 서버에만).
- 프로젝트 폴더가 홈 디렉터리와 같으면 워크스페이스 설정은 무시됩니다(전역과 중복 방지).

---

## 🪟 Windows 공통 주의사항

| 항목 | 내용 |
|---|---|
| 🔴 `cmd /c` 래핑 | `npx`/`uvx`는 Windows에서 `.cmd` 셸 스크립트라 직접 spawn하면 `ENOENT`가 납니다. 반드시 `"command": "cmd", "args": ["/c", "npx", ...]` 형태로. |
| 🟠 JSON 백슬래시 | JSON 안의 Windows 경로는 `C:\\Users\\...` 처럼 백슬래시 2개로. 슬래시(`C:/Users/...`)도 동작합니다. |
| 🟠 Node.js 필요 | `npx` 기반 서버는 Node 20+ 필요. `winget install OpenJS.NodeJS.LTS` |
| 🟡 첫 실행 지연 | `npx -y`는 최초 1회 패키지를 내려받아 30초 이상 걸릴 수 있습니다 → `startup_timeout_sec` / `timeout` 넉넉히. |
| 🟡 경로에 공백 | `C:\Program Files\...` 처럼 공백이 있으면 args 배열의 **한 원소**로 넣습니다(따옴표 추가 불필요). |
| 🔒 토큰 관리 | PAT를 파일에 직접 쓰지 말고 환경변수로: `setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."` (새 터미널부터 적용). **Claude Desktop만** 환경변수를 못 읽어 직접 입력이 필요합니다. |

## 🔒 커밋 전 확인
`.codex/config.toml`, `.gemini/settings.json`, `.mcp.json`은 환경변수 참조만 쓰므로 커밋해도 안전합니다.
**`mcp/claude_desktop_config.json`에 실제 토큰을 넣었다면 커밋하지 마세요** — 로컬에서만 채우거나 `.gitignore`에 추가하세요.

## 📦 등록된 서버 5종 (세 파일 공통)

| 서버 | 패키지 | 용도 |
|---|---|---|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | 프로젝트 폴더 읽기/쓰기 (인자로 허용 경로 지정) |
| `memory` | `@modelcontextprotocol/server-memory` | 지식 그래프 기반 장기 메모리 |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | 단계적 추론 보조 |
| `playwright` | `@playwright/mcp` | 브라우저 자동화 · 스크린샷 (이 저장소 E2E 테스트와 연계) |
| `github` | 원격 `api.githubcopilot.com/mcp/` | 이슈 · PR · 코드 검색 (PAT 필요) |

서버를 빼려면 해당 블록만 삭제하면 됩니다.
