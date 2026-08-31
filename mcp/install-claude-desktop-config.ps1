# Claude Desktop MCP 설정 배포 스크립트 (Windows 10/11)
#
# Claude Desktop은 프로젝트 폴더의 설정을 읽지 못하고 전역 경로 한 곳만 봅니다.
# 이 스크립트는 프로젝트에 보관된 원본을 실제 경로로 복사합니다.
#
#   실행: powershell -ExecutionPolicy Bypass -File .\mcp\install-claude-desktop-config.ps1

$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'claude_desktop_config.json'
if (-not (Test-Path $source)) { throw "원본을 찾을 수 없습니다: $source" }

# MSIX(Microsoft Store) 설치본은 경로가 다릅니다. 존재하는 쪽을 자동 선택.
$msix = Join-Path $env:LOCALAPPDATA 'Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude'
$std  = Join-Path $env:APPDATA 'Claude'
$target = if (Test-Path $msix) { $msix } else { $std }

New-Item -ItemType Directory -Force $target | Out-Null
$dest = Join-Path $target 'claude_desktop_config.json'

if (Test-Path $dest) {
    $backup = "$dest.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item $dest $backup
    Write-Host "기존 설정 백업: $backup" -ForegroundColor Yellow
}

# 프로젝트 절대 경로로 자리표시자 치환 (Claude Desktop은 환경변수/상대경로 미지원)
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$json = Get-Content $source -Raw -Encoding UTF8
$json = $json -replace [regex]::Escape('C:\\Users\\<사용자명>\\WorkSpace\\Daily-News'), ($projectRoot -replace '\\', '\\\\')

Set-Content -Path $dest -Value $json -Encoding UTF8
Write-Host "설정 배포 완료: $dest" -ForegroundColor Green
Write-Host "프로젝트 경로: $projectRoot" -ForegroundColor Green
Write-Host ""
Write-Host "남은 작업:" -ForegroundColor Cyan
Write-Host "  1. github 서버의 'ghp_여기에_실제_토큰'을 실제 PAT로 교체"
Write-Host "  2. Claude Desktop을 트레이 아이콘까지 완전히 종료 후 재시작"
