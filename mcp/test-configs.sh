#!/usr/bin/env bash
# MCP 설정 파일 검증 하네스 — 리눅스 컨테이너에서 실행 가능
#
#   [A] 문법 + 스키마       각 파일이 유효한 JSON/TOML이고 필요한 키를 갖췄는가
#   [B] 프로젝트 설정 로딩   각 CLI가 프로젝트 폴더의 설정을 실제로 읽는가
#   [C] 부정 대조군         설정이 없는 빈 폴더에서는 아무것도 안 잡히는가
#                          (→ [B]의 출처가 프로젝트 파일임을 증명)
#   [D] 서버 기동 + 연결     MCP 서버가 실제로 뜨고 tools/list에 응답하는가
#
# [B]는 Windows용 "cmd /c" 원본 그대로 — 리눅스에 cmd.exe가 없으므로
# '연결'은 실패가 정상이고, 서버 '인식' 여부만 판정합니다.
# [D]는 래퍼만 벗긴 리눅스 등가 사본으로 실제 연결까지 확인합니다.
#
# 사용법: bash mcp/test-configs.sh

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/mcp-config-test.$$"
PASS=0; FAIL=0
ok()  { echo "  ✅ $*"; PASS=$((PASS+1)); }
bad() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
sec() { echo; echo "━━━ $* ━━━"; }
trap 'rm -rf "$TMP"' EXIT

# ══════════════════════════════════════════════════════════
sec "[A] 문법 + 스키마"

node -e '
const fs=require("fs"), root=process.argv[1];
const expect=["filesystem","memory","sequential-thinking","playwright","github"];
let bad=0;
for (const [label,f] of [["Claude  .mcp.json",".mcp.json"],
                         ["Gemini  .gemini/settings.json",".gemini/settings.json"]]) {
  const j=JSON.parse(fs.readFileSync(`${root}/${f}`,"utf8"));
  const names=Object.keys(j.mcpServers||{});
  const missing=expect.filter(e=>!names.includes(e));
  if(missing.length){ console.log(`  ❌ ${label}: 누락 ${missing}`); bad=1; continue; }
  for(const [n,s] of Object.entries(j.mcpServers))
    if(s.command===undefined && s.url===undefined){ console.log(`  ❌ ${label}/${n}: command도 url도 없음`); bad=1; }
  console.log(`  ✅ ${label}: JSON 유효, 서버 ${names.length}종`);
}
// Gemini는 httpUrl이 deprecated — url + type 사용을 강제
const g=JSON.parse(fs.readFileSync(`${root}/.gemini/settings.json`,"utf8"));
for(const [n,s] of Object.entries(g.mcpServers))
  if(s.httpUrl){ console.log(`  ❌ Gemini/${n}: httpUrl은 deprecated — url + type:"http" 사용`); bad=1; }
process.exit(bad);
' "$ROOT" && ok "JSON 스키마" || bad "JSON 스키마"

python3 - "$ROOT" <<'PY'
import sys, tomllib
d = tomllib.load(open(sys.argv[1] + "/.codex/config.toml", "rb"))
srv = d.get("mcp_servers", {})
missing = {"filesystem","memory","sequential-thinking","playwright","github"} - set(srv)
assert not missing, f"누락 {missing}"
deny = {"openai_base_url","chatgpt_base_url","apps_mcp_product_sku","responses_api_metadata",
        "model_provider","model_providers","notify","profile","profiles","otel",
        "experimental_realtime_webrtc_call_base_url","experimental_realtime_ws_base_url"}
found = deny & set(d)
assert not found, f"프로젝트 레이어에서 무시되는 키: {found}"
assert "experimental_use_rmcp_client" not in d, "현재 Codex에 존재하지 않는 키"
for n, s in srv.items():
    assert "command" in s or "url" in s, f"{n}: command도 url도 없음"
print(f"  ✅ Codex   .codex/config.toml: TOML 유효, 서버 {len(srv)}종, denylist 키 없음")
PY
[ $? -eq 0 ] && ok "TOML 스키마" || bad "TOML 스키마"

# ══════════════════════════════════════════════════════════
sec "[B] 각 CLI가 프로젝트 폴더 설정을 읽는가 (Windows 원본 그대로)"
echo "  리눅스에 cmd.exe가 없어 '연결' 실패는 정상 — '인식' 여부가 판정 기준"

probe() { # $1=라벨 $2=명령 $3=작업폴더
  local out; out="$(cd "$3" && timeout 300 $2 2>&1)"
  echo "$out" | sed 's/^/    /' | head -12
  echo "$out" | grep -q "sequential-thinking"
}

echo; echo "  · Claude Code — .mcp.json"
probe claude "claude mcp list" "$ROOT" && ok "Claude가 .mcp.json 인식" || bad "Claude가 .mcp.json 미인식"

echo; echo "  · Codex — .codex/config.toml"
probe codex "codex mcp list" "$ROOT" && ok "Codex가 .codex/config.toml 인식" || bad "Codex가 .codex/config.toml 미인식 (폴더 신뢰 확인 필요)"

echo; echo "  · Gemini CLI — .gemini/settings.json"
probe gemini "gemini mcp list" "$ROOT" && ok "Gemini가 .gemini/settings.json 인식" || bad "Gemini가 .gemini/settings.json 미인식 (폴더 신뢰 확인 필요)"

# ══════════════════════════════════════════════════════════
sec "[C] 부정 대조군 — 설정 없는 빈 폴더"
mkdir -p "$TMP/empty"
none=1
for c in "claude mcp list" "codex mcp list" "gemini mcp list"; do
  out="$(cd "$TMP/empty" && timeout 300 $c 2>&1)"
  echo "    ${c%% *}: $(echo "$out" | head -1)"
  echo "$out" | grep -q "sequential-thinking" && none=0
done
[ "$none" -eq 1 ] && ok "빈 폴더에선 아무 서버도 안 잡힘 → [B]의 출처는 프로젝트 파일" \
                  || bad "빈 폴더에서도 서버가 잡힘 → 전역 설정 오염"

# ══════════════════════════════════════════════════════════
sec "[D] 서버 기동 + 연결 (리눅스 등가 사본)"
mkdir -p "$TMP/proj/.claude/memory"
node "$ROOT/mcp/linuxify.mjs" "$ROOT" "$TMP/proj"

echo "  · raw stdio 핸드셰이크 (initialize → tools/list)"
node "$ROOT/mcp/handshake.mjs" "$TMP/proj" \
  && ok "전 stdio 서버 핸드셰이크 성공" || bad "일부 서버 핸드셰이크 실패"

# Gemini는 미신뢰 폴더의 MCP 서버를 비활성화하므로, 임시 프로젝트를
# 신뢰 목록에 등록한다. 사용자의 실제 목록은 건드리지 않도록 별도 파일에.
echo; echo "  · Gemini CLI 실제 연결 (임시 프로젝트를 신뢰 등록)"
printf '{"%s":"TRUST_FOLDER"}' "$TMP/proj" > "$TMP/trusted.json"
out="$(cd "$TMP/proj" && GEMINI_CLI_TRUSTED_FOLDERS_PATH="$TMP/trusted.json" timeout 300 gemini mcp list 2>&1)"
echo "$out" | sed 's/^/    /' | head -10
[ "$(echo "$out" | grep -c '✓')" -ge 4 ] && ok "Gemini stdio 4종 연결" || bad "Gemini 연결 실패"

# ══════════════════════════════════════════════════════════
echo; echo "━━━ 결과 ━━━"; echo "  통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ]
