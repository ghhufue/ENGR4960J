import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const memberFile = resolve(process.env.SYNC_MEMBERS_FILE || resolve(process.env.SYNC_DATA_DIR || 'data', 'sync-members.json'));
let members;
try { members = JSON.parse(await readFile(memberFile, 'utf8')); }
catch { throw new Error('请先运行 npm run sync:members 创建成员令牌，再启动公网后端。'); }
if (!Array.isArray(members) || !members.length) throw new Error('公网后端必须配置成员令牌。');
const child = spawn(process.execPath, [fileURLToPath(new URL('../server/index.mjs', import.meta.url))], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, HOST: process.env.HOST || '127.0.0.1', PORT: process.env.PORT || '5173', SYNC_MEMBERS_FILE: memberFile, SYNC_ALLOWED_ORIGINS: process.env.SYNC_ALLOWED_ORIGINS || 'https://ghhufue.github.io' }
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
