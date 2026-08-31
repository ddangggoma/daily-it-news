#!/usr/bin/env node
// Windows용 설정 3종을 리눅스 등가로 변환해 임시 프로젝트에 생성합니다.
// "cmd /c <x>" → "<x>" 로 실행 셸만 바꾸고 서버 인자·구조는 그대로 둡니다.
// 컨테이너에서 실제 연결까지 검증하기 위한 테스트 전용 변환입니다.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [root, dest] = process.argv.slice(2);
const unwrap = (s) =>
  s.command === 'cmd' && s.args?.[0] === '/c'
    ? { ...s, command: s.args[1], args: s.args.slice(2) }
    : s;

// Claude .mcp.json
const claude = JSON.parse(readFileSync(`${root}/.mcp.json`, 'utf8'));
claude.mcpServers = Object.fromEntries(
  Object.entries(claude.mcpServers).map(([n, s]) => [n, unwrap(s)]),
);
writeFileSync(`${dest}/.mcp.json`, JSON.stringify(claude, null, 2));

// Gemini .gemini/settings.json
mkdirSync(`${dest}/.gemini`, { recursive: true });
const gem = JSON.parse(readFileSync(`${root}/.gemini/settings.json`, 'utf8'));
gem.mcpServers = Object.fromEntries(
  Object.entries(gem.mcpServers).map(([n, s]) => [n, unwrap(s)]),
);
writeFileSync(`${dest}/.gemini/settings.json`, JSON.stringify(gem, null, 2));

// Codex .codex/config.toml — TOML은 줄 단위 치환으로 충분
mkdirSync(`${dest}/.codex`, { recursive: true });
const toml = readFileSync(`${root}/.codex/config.toml`, 'utf8')
  .replace(/^command = "cmd"$/gm, 'command = "npx"')
  .replace(/^args = \["\/c", "npx", /gm, 'args = [')
  .replace(/\.claude\\\\memory\\\\mcp-memory\.json/g, '.claude/memory/mcp-memory.json');
writeFileSync(`${dest}/.codex/config.toml`, toml);

console.log(`  변환 완료 → ${dest}`);
