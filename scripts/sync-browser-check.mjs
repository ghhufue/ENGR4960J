// Two actual Chromium pages, exercising the collaboration UI against an isolated server.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createSyncServer } from '../server/index.mjs';
const temp = resolve('.tmp', `sync-browser-${Date.now()}`); await mkdir(temp, { recursive: true });
let executable;
for (const candidate of [process.env.BROWSER_EXECUTABLE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) { try { await access(candidate); executable = candidate; break; } catch {} }
if (!executable) throw new Error('Chromium executable required.');
const frontend = process.env.SYNC_BROWSER_FRONTEND;
const tokenA = randomBytes(32).toString('hex'), tokenB = randomBytes(32).toString('hex');
const sharedCode = 'browser-shared-code';
const options = { database: frontend ? resolve(temp, 'verification.sqlite') : ':memory:', members: [{ id: 'a', name: '甲', token: tokenA, admin: true }, { id: 'b', name: '乙', token: tokenB, accessCode: sharedCode }], allowedOrigins: frontend ? [new URL(frontend).origin] : [] };
const apiRequests = [], browserFailures = [];
async function startServer() {
  const serverApp = await createSyncServer(options);
  serverApp.server.on('request', (request, response) => response.on('finish', () => { if (request.url.startsWith('/api/')) apiRequests.push({ method: request.method, path: request.url, origin: request.headers.origin || null, status: response.statusCode, allowedOrigin: response.getHeader('Access-Control-Allow-Origin') || null }); }));
  try { await new Promise((resolveListen, reject) => { serverApp.server.once('error', reject); serverApp.server.listen(frontend ? 5173 : 0, '127.0.0.1', resolveListen); }); }
  catch (error) { serverApp.service.close(); throw error; }
  return serverApp;
}
let app = await startServer(); const origin = frontend || `http://127.0.0.1:${app.server.address().port}`;
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms)); const sockets = [], exceptions = [];
async function attach(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl); sockets.push(socket); let id = 0; const pending = new Map();
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails); else if (message.method === 'Network.loadingFailed' && message.params.corsErrorStatus) browserFailures.push(message.params.corsErrorStatus); });
  const command = (method, params = {}) => new Promise((resolveCommand, reject) => { const next = ++id; pending.set(next, { resolve: resolveCommand, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const wait = async expression => { for (let attempt = 0; attempt < 180; attempt++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timeout: ${expression}\nRuntime: ${JSON.stringify(exceptions)}\nServer: ${JSON.stringify(app.service.get('default').state.meta)}\nPage: ${JSON.stringify(await evaluate("({active: document.activeElement.outerHTML, hidden:document.hidden, cache: Object.keys(localStorage).filter(k=>k.startsWith('engr4960j.sync.')&&!k.endsWith('.workbench')).map(k=>{const x=JSON.parse(localStorage[k]); return {key:k,revision:x.revision,meta:x.workingState?.meta}})})"))}\n${await evaluate('document.body.innerText.slice(0,800)')}`); };
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.click(); })()`);
  const fill = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable'); await command('Page.navigate', { url: origin }); await wait("document.readyState === 'complete' && !!document.getElementById('collaboration-toggle') && !document.getElementById('boot-message')");
  return { command, evaluate, wait, click, fill };
}
let passed = false;
try {
  let port;
  for (let attempt = 0; attempt < 80; attempt++) { try { port = (await readFile(resolve(temp, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); } }
  if (!port) throw new Error('Chromium debugging endpoint unavailable.');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const a = await attach(pages.find(page => page.type === 'page'));
  const second = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); const b = await attach(second);
  for (const [page, token] of [[a, tokenA], [b, sharedCode]]) {
    await page.click('#collaboration-toggle'); await page.fill('#sync-connect [name="token"]', token); await page.evaluate("document.getElementById('sync-connect').requestSubmit()");
    await page.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')"); await page.click('[data-sync="close"]');
  }
  const group = '[data-target="meta"][data-key="group"]', introduction = '[data-target="meta"][data-key="introduction"]';
  await a.fill(group, '浏览器 A 小组'); await b.fill(introduction, '浏览器 B 简介');
  await a.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')"); await b.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')");
  await a.evaluate("document.getElementById('collaboration-toggle').focus()"); await b.evaluate("document.getElementById('collaboration-toggle').focus()");
  await a.command('Page.bringToFront');
  await a.evaluate("document.getElementById('collaboration-toggle').focus()");
  await a.wait(`document.querySelector(${JSON.stringify(introduction)}).value === '浏览器 B 简介'`);
  await b.command('Page.bringToFront');
  await b.wait(`document.querySelector(${JSON.stringify(group)}).value === '浏览器 A 小组'`);
  console.log('PASS: two browser pages sync independent fields.');
  // B captures the old field before A saves, and keeps focus while remote polling runs.
  await b.evaluate(`document.querySelector(${JSON.stringify(group)}).focus()`); await a.fill(group, 'A 最新小组');
  await a.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')"); await delay(2800);
  await b.fill(group, 'B 冲突小组'); await b.evaluate('document.activeElement.blur()');
  await b.wait("document.getElementById('collaboration-toggle').textContent.includes('待人工裁定')");
  await b.click('#collaboration-toggle'); assert(await b.evaluate("document.getElementById('collaboration-dialog').innerText.includes('B 冲突小组') && !document.querySelector('[data-sync=proposed]')")); await b.click('[data-sync="close"]');
  await a.command('Page.bringToFront'); await a.evaluate("document.getElementById('collaboration-toggle').focus()"); await a.wait("document.getElementById('collaboration-toggle').textContent.includes('待人工裁定')");
  await a.click('#collaboration-toggle'); await a.click('[data-sync="proposed"]'); await a.wait("document.getElementById('collaboration-dialog').innerText.includes('没有待裁定冲突')"); await a.click('[data-sync="close"]');
  await b.command('Page.bringToFront'); await b.wait(`document.querySelector(${JSON.stringify(group)}).value === 'B 冲突小组'`);
  console.log('PASS: stale field snapshot queues a conflict; only admin can accept it, and the result syncs.');
  await a.command('Page.bringToFront'); await a.click('.sidebar [data-route="step-1"]'); await a.click('[data-action="add"][data-type="stakeholders"]');
  await a.wait("document.querySelector('[data-target=\"STK-001\"][data-key=\"title\"]')");
  await a.fill('[data-target="STK-001"][data-key="title"]', '共同群体');
  await a.click('input[data-target="STK-001"][data-key="impacts"][value="生命与健康"]');
  await a.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')");
  await b.command('Page.bringToFront'); await b.click('.sidebar [data-route="step-1"]'); await b.wait("document.querySelector('[data-action=edit][data-id=\"STK-001\"]')"); await b.click('[data-action="edit"][data-id="STK-001"]');
  await b.click('input[data-target="STK-001"][data-key="impacts"][value="环境"]'); await b.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')");
  assert.deepEqual(app.service.get('default').state.records[0].data.impacts, ['生命与健康', '环境']);
  await b.click('#language-toggle'); await b.click('#collaboration-toggle'); assert(!/[\u3400-\u9fff]/.test(await b.evaluate("document.getElementById('collaboration-dialog').querySelector('h2').textContent"))); await b.click('[data-sync="close"]');
  await b.evaluate('window.__reloadMarker = true'); await b.command('Page.reload'); await b.wait("!window.__reloadMarker && document.getElementById('collaboration-toggle')?.textContent.includes('Synced')");
  await b.click('.sidebar [data-route="overview"]'); await b.wait(`document.querySelector(${JSON.stringify(group)}).value === 'B 冲突小组'`);
  console.log('PASS: server-assigned record IDs, merged lists, English collaboration UI and reload recovery.');
  if (frontend) {
    app.server.closeAllConnections(); await app.close(); app = await startServer();
    await a.command('Page.bringToFront'); await a.evaluate("document.getElementById('collaboration-toggle').focus(); window.dispatchEvent(new Event('focus'))");
    await a.wait("document.getElementById('collaboration-toggle').textContent.includes('已同步')");
    assert.equal(app.service.get('default').state.meta.group, 'B 冲突小组');
    assert.deepEqual(app.service.get('default').state.records[0].data.impacts, ['生命与健康', '环境']);
    assert(apiRequests.some(request => request.method === 'OPTIONS' && request.status === 204));
    assert(apiRequests.some(request => request.method === 'POST' && request.status === 200 && request.origin === new URL(frontend).origin));
    assert.deepEqual(browserFailures, []);
    console.log('PASS: actual GitHub Pages CORS preflight, authenticated HTTPS writes and SQLite restart persistence.');
  }
  await a.click('#collaboration-toggle'); const screenshot = await a.command('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(temp, 'collaboration.png'), Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(exceptions, []); passed = true; console.log(`Browser QA artifacts: ${temp}`);
} finally { await writeFile(resolve(temp, 'report.json'), JSON.stringify({ frontend: origin, passed, runtimeExceptions: exceptions, corsFailures: browserFailures, apiRequests }, null, 2)); for (const socket of sockets) socket.close(); browser.kill(); app.server.closeAllConnections(); await app.close(); }
