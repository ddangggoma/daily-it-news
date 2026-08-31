#!/usr/bin/env node
// 각 stdio MCP 서버를 실제로 띄워 initialize → tools/list 핸드셰이크를 수행합니다.
// .mcp.json을 단일 소스로 읽고, Windows 래퍼("cmd /c")만 벗겨 리눅스에서 실행합니다.

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const root = process.argv[2] ?? '.';
const cfg = JSON.parse(readFileSync(`${root}/.mcp.json`, 'utf8')).mcpServers;

// "cmd /c npx ..." → "npx ..."  (인자는 그대로, 실행 셸만 교체)
function toPosix({ command, args = [] }) {
  if (command === 'cmd' && args[0] === '/c') return { command: args[1], args: args.slice(2) };
  return { command, args };
}

function handshake(name, spec, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const { command, args } = toPosix(spec);
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(spec.env ?? {}) },
    });

    let buf = '', stderr = '', done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); child.kill('SIGKILL'); resolve(r); };
    const timer = setTimeout(() => finish({ name, ok: false, error: `timeout ${timeoutMs}ms`, stderr }), timeoutMs);

    child.on('error', (e) => finish({ name, ok: false, error: e.message, stderr }));
    child.stderr.on('data', (d) => { stderr += d; });

    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }

        if (msg.id === 1 && msg.result) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (msg.id === 2) {
          if (msg.error) finish({ name, ok: false, error: JSON.stringify(msg.error), stderr });
          else finish({ name, ok: true, tools: (msg.result?.tools ?? []).map((t) => t.name) });
        } else if (msg.id === 1 && msg.error) {
          finish({ name, ok: false, error: JSON.stringify(msg.error), stderr });
        }
      }
    });

    const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');
    send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-config-test', version: '1.0.0' },
      },
    });
  });
}

const stdio = Object.entries(cfg).filter(([, s]) => s.command);
const http = Object.entries(cfg).filter(([, s]) => s.url);

const results = [];
for (const [name, spec] of stdio) results.push(await handshake(name, spec));

let failed = 0;
for (const r of results) {
  if (r.ok) {
    const preview = r.tools.slice(0, 4).join(', ');
    console.log(`  ✅ ${r.name.padEnd(20)} tools ${String(r.tools.length).padStart(2)}종 — ${preview}${r.tools.length > 4 ? ', …' : ''}`);
  } else {
    failed++;
    console.log(`  ❌ ${r.name.padEnd(20)} ${r.error}`);
    if (r.stderr) console.log(`     stderr: ${r.stderr.trim().split('\n').slice(-3).join(' | ').slice(0, 300)}`);
  }
}
for (const [name, spec] of http) {
  console.log(`  ⏭️  ${name.padEnd(20)} 원격 HTTP (${spec.url}) — PAT 필요, 기동 테스트 제외`);
}

process.exit(failed === 0 ? 0 : 1);
