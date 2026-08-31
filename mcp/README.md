# MCP 설정 — Windows 10/11 · 프로젝트 폴더 기준

Claude · Codex · Gemini CLI 세 도구의 MCP 설정입니다.
**세 도구 모두 프로젝트 폴더 안의 설정 파일로 동작합니다.** 각 도구의 공식 문서와 오픈소스 구현으로 확인하고, 리눅스 컨테이너에서 실제 실행 테스트까지 마쳤습니다.

## 📁 파일 위치 (프로젝트 루트 기준 상대 경로)

| 도구 | 📄 파일 | 적용 범위 |
|---|---|---|
| **Claude** | `.mcp.json` | 데스크탑 앱 **Code 탭** + Claude Code CLI/IDE |
| **Codex** | `.codex/config.toml` | 데스크탑 앱 + IDE 확장 + CLI (공통 백엔드) |
| **Gemini CLI** | `.gemini/settings.json` | Gemini CLI |

부속 파일:

| 파일 | 용도 |
|---|---|
| `mcp/test-configs.sh` | 검증 하네스 (아래 [테스트](#-테스트-결과) 참조) |
| `mcp/handshake.mjs` | MCP 서버 `initialize`→`tools/list` 핸드셰이크 테스터 |
| `mcp/linuxify.mjs` | 테스트용 리눅스 등가 변환기 |
| `mcp/claude_desktop_config.json` | *(선택)* Claude Desktop **Chat 탭** 전용 — 전역 경로 필요 |
| `mcp/install-claude-desktop-config.ps1` | *(선택)* 위 파일을 전역 경로에 배포 |

---

## 1️⃣ Claude — `.mcp.json`

프로젝트 루트에 두면 그대로 인식됩니다. **데스크탑 앱 Code 탭도 이 파일을 읽습니다.**

> 공식 문서: *"The Desktop app loads MCP servers from `claude_desktop_config.json` into local Code tab sessions, **alongside servers from `~/.claude.json` and `.mcp.json`**."*

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
claude                 # 첫 실행 시 프로젝트 MCP 서버 승인 → Approve
claude mcp list        # 연결 상태 확인
```

**우선순위** — 같은 이름의 서버가 여러 곳에 있을 때:

| 상황 | 이기는 쪽 |
|---|---|
| CLI 기본 | Local(`~/.claude.json`) → **Project(`.mcp.json`)** → User → 플러그인 → 커넥터 |
| 데스크탑 Code 탭 | `claude_desktop_config.json` 이 `.mcp.json`·`~/.claude.json` 보다 우선 |
| 데스크탑 Code 탭 (stdio) | `~/.claude.json`(user)이 `.mcp.json` 보다 우선 — **CLI와 순서가 다름** |

- ✅ **환경변수 치환 지원** — `${VAR}`, `${VAR:-기본값}`.
- 🟡 프로젝트 서버는 **최초 1회 승인**이 필요합니다. 초기화는 `claude mcp reset-project-choices`.
- 🟡 Chat 탭은 이 파일을 읽지 않습니다 → 아래 5️⃣ 참조.
- 🟡 npx 콜드 스타트가 느리면 `MCP_TIMEOUT` 환경변수로 기동 대기시간을 늘리세요.

---

## 2️⃣ Codex — `.codex/config.toml`

`CODEX_HOME` 같은 환경변수 없이 그대로 동작합니다. cwd에서 프로젝트 루트까지 상위 폴더를 훑으며 각 폴더의 `.codex\config.toml`을 병합합니다(깊은 폴더가 우선). CLI·IDE 확장·데스크탑 앱이 같은 백엔드를 쓰므로 셋 다 동일하게 적용됩니다.

**우선순위** (`ConfigLayerSource::precedence()`):

```
packaged(-10) < MDM(0) < system(10) < enterprise(15)
  < user  %USERPROFILE%\.codex\config.toml   (20 / 프로필 지정 시 21)
  < ★ project  .codex\config.toml             (25)
  < 세션 플래그 --config                        (30)
```

🔴 **전제조건 — 폴더 신뢰.** 해당 폴더에서 Codex를 처음 실행하면 "Do you trust this folder?"가 뜨고, 승인하면 **사용자 설정**에 기록됩니다:

```toml
# %USERPROFILE%\.codex\config.toml
[projects."C:\\Users\\<사용자명>\\WorkSpace\\Daily-News"]
trust_level = "trusted"
```

신뢰 전에는 이 파일이 **통째로 무시**됩니다(CLI는 조용히, 앱은 경고 표시). `trust_level`은 반드시 사용자 설정에 있어야 하며, 프로젝트 파일에 적어 스스로를 신뢰하게 만들 수는 없습니다.

- 🟠 **프로젝트 레이어에서 무시되는 키** — `model_provider`, `model_providers`, `profile`, `profiles`, `notify`, `openai_base_url`, `chatgpt_base_url`, `otel`, `responses_api_metadata`, `apps_mcp_product_sku`, `experimental_realtime_*`. **`mcp_servers`는 무시 목록에 없어 정상 동작합니다.**
- 🟡 `CODEX_HOME`은 **사용자 설정 위치**를 바꾸는 변수일 뿐, 프로젝트 설정과 무관합니다.
- 원격 서버는 `url` + `bearer_token_env_var`(토큰 값이 아니라 **환경변수 이름**). Streamable HTTP가 기본 지원이라 별도 실험 플래그가 필요 없습니다.
- 서버를 잠시 끄려면 해당 블록에 `enabled = false`.

---

## 3️⃣ Gemini CLI — `.gemini/settings.json`

프로젝트 루트의 `.gemini/settings.json`을 읽어 전역 설정(`%USERPROFILE%\.gemini\settings.json`)과 **shallow merge**합니다. 같은 이름의 서버는 프로젝트 설정이 이깁니다.

```powershell
cd C:\Users\<사용자명>\WorkSpace\Daily-News
gemini
/mcp        # 등록된 서버·툴 목록 확인
```

🔴 **전제조건 — 폴더 신뢰.** 미신뢰 폴더에서는 프로젝트 서버는 물론 **사용자 전역 서버까지 함께 비활성화**됩니다:

> `Warning: MCP servers are configured but disabled because this folder is untrusted.`

첫 실행 시 신뢰 프롬프트를 승인하면 `%USERPROFILE%\.gemini\trustedFolders.json`에 기록됩니다:

```json
{ "C:\\Users\\<사용자명>\\WorkSpace\\Daily-News": "TRUST_FOLDER" }
```

값은 `TRUST_FOLDER` / `TRUST_PARENT` / `DO_NOT_TRUST` 셋 중 하나입니다.

- ✅ **환경변수 치환 지원** — `$VAR`, `${VAR}`, 기본값 `${VAR:-기본값}`.
- 🟠 **`httpUrl`은 deprecated** — 원격 서버는 `url` + `type: "http"`를 쓰세요(이 템플릿 적용 완료). SSE는 `type: "sse"`.
- `trust: true`는 해당 서버 툴 호출 시 확인 프롬프트를 건너뜁니다(신뢰하는 서버에만).
- 프로젝트 폴더가 홈 디렉터리와 같으면 워크스페이스 설정은 무시됩니다.

---

## 4️⃣ *(선택)* Claude Desktop **Chat 탭** — 전역 전용

Code 탭과 달리 **Chat 탭은 프로젝트 폴더 설정을 읽지 않습니다.** 작업 폴더 개념이 없어 전역 파일 한 곳만 봅니다. Chat 탭에서도 같은 서버를 쓰고 싶을 때만 필요합니다.

| 설치 형태 | 경로 |
|---|---|
| 일반 설치 (.exe) | `%APPDATA%\Claude\claude_desktop_config.json` |
| MSIX / Microsoft Store | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp\install-claude-desktop-config.ps1
```

경로 자동 판별 + 기존 설정 백업 + 프로젝트 절대 경로 치환을 처리합니다.

- 🟠 앱 내 **"Edit Config" 버튼이 MSIX 설치본에서 엉뚱한 파일을 여는 알려진 버그**가 있습니다. 편집했는데 서버가 안 뜨면 위 두 경로를 직접 확인하세요.
- 🔴 **환경변수 치환·상대 경로 미지원** — 절대 경로와 실제 토큰 문자열을 직접 넣어야 합니다.
- 🟡 원격 MCP는 stdio 프록시(`mcp-remote`)를 거칩니다.
- 반영하려면 **트레이 아이콘까지 완전히 종료 후** 재시작. 로그: `%APPDATA%\Claude\logs\mcp-server-<이름>.log`

---

## 🧪 테스트 결과

```bash
bash mcp/test-configs.sh     # 통과 8 · 실패 0
```

| 축 | 내용 | 결과 |
|---|---|---|
| **[A]** 문법·스키마 | JSON/TOML 유효성, 서버 5종 존재, Codex denylist 키 없음, Gemini `httpUrl` 미사용 | ✅ |
| **[B]** 설정 로딩 | 프로젝트 폴더에서 `claude` / `codex` / `gemini` 각 `mcp list`가 5종 인식 | ✅ |
| **[C]** 부정 대조군 | 빈 폴더에선 세 도구 모두 "No MCP servers configured" → [B]의 출처가 프로젝트 파일임을 증명 | ✅ |
| **[D]** 기동·연결 | 4개 stdio 서버 `initialize`→`tools/list` 응답 (14/9/1/24종 툴), Gemini 실제 연결 4/4 `Connected` | ✅ |

**테스트로 잡은 실제 결함** — `timeout: 30000`(30초)이 `npx -y` 콜드 스타트에 부족해 filesystem·memory·sequential-thinking 3종이 `Disconnected`. 120초로 올려 4/4 연결 확인. Codex `startup_timeout_sec`도 같은 근거로 120초 통일.

**검증하지 못한 부분**:
- `cmd /c` 래핑은 Windows 전용이라 컨테이너에서 실행 불가 → [D]는 래퍼만 벗긴 등가 사본으로 확인했습니다. 래퍼 유무는 실행 셸만 바꾸고 서버 인자는 동일합니다.
- `github` 원격 서버는 PAT가 없고 컨테이너 egress 정책이 `api.githubcopilot.com`을 막아 연결 테스트에서 제외했습니다. 다만 세 도구 모두 설정을 정상 인식했고, Claude는 `GITHUB_PERSONAL_ACCESS_TOKEN` 미설정을 이름으로 짚어내 **환경변수 치환이 동작함을 확인**했습니다.
- Claude Desktop / Codex 데스크탑 앱 GUI 자체는 컨테이너에서 실행할 수 없어, 앱과 같은 설정 경로·백엔드를 쓰는 CLI로 검증했습니다.

---

## 🪟 Windows 공통 주의사항

| 항목 | 내용 |
|---|---|
| 🔴 `cmd /c` 래핑 | `npx`/`uvx`는 Windows에서 `.cmd` 셸 스크립트라 직접 spawn하면 `ENOENT`가 납니다. 반드시 `"command": "cmd", "args": ["/c", "npx", ...]` 형태로. |
| 🔴 타임아웃 | `npx -y`는 최초 1회 패키지를 내려받아 30초를 훌쩍 넘깁니다. **120초 권장** (테스트로 실증). |
| 🟠 JSON 백슬래시 | JSON 안의 Windows 경로는 `C:\\Users\\...` 처럼 백슬래시 2개로. 슬래시(`C:/Users/...`)도 동작합니다. |
| 🟠 Node.js 필요 | `npx` 기반 서버는 Node 20+ 필요. `winget install OpenJS.NodeJS.LTS` |
| 🟡 폴더 신뢰 | Codex·Gemini·Claude 모두 신뢰/승인 게이트가 있습니다. 서버가 안 보이면 **가장 먼저 이것부터** 확인하세요. |
| 🟡 경로에 공백 | `C:\Program Files\...` 처럼 공백이 있으면 args 배열의 **한 원소**로 넣습니다(따옴표 추가 불필요). |
| 🔒 토큰 관리 | `setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."` (새 터미널부터 적용). **Chat 탭 설정만** 환경변수를 못 읽어 직접 입력이 필요합니다. |

## 🔒 커밋 전 확인
`.mcp.json`, `.codex/config.toml`, `.gemini/settings.json`은 환경변수 참조만 쓰므로 커밋해도 안전합니다.
**`mcp/claude_desktop_config.json`에 실제 토큰을 넣었다면 커밋하지 마세요.**

## 📦 등록된 서버 5종 (세 파일 공통)

| 서버 | 패키지 | 툴 수 | 용도 |
|---|---|---|---|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | 14 | 프로젝트 폴더 읽기/쓰기 |
| `memory` | `@modelcontextprotocol/server-memory` | 9 | 지식 그래프 기반 장기 메모리 |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | 1 | 단계적 추론 보조 |
| `playwright` | `@playwright/mcp` | 24 | 브라우저 자동화 · 스크린샷 |
| `github` | 원격 `api.githubcopilot.com/mcp/` | — | 이슈 · PR · 코드 검색 (PAT 필요) |

*툴 수는 위 [D] 테스트에서 실제 `tools/list` 응답으로 확인한 값입니다.*
