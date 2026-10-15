import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup } from 'node:sqlite';
import { ProjectService } from '../server/project-service.mjs';
import { createSyncServer } from '../server/index.mjs';
import { Store, STORAGE_KEY } from '../src/js/core/store.js';
import { markReviewed, reviewStatus } from '../src/js/core/review.js';
import { SyncClient } from '../src/js/core/sync.js';
import { PUBLIC_SYNC_API, syncApiBase } from '../src/js/core/sync-config.js';
import { readField, copy, equal, requestId, changes } from '../src/js/core/sync-protocol.js';
const admin = { id: 'a', name: '甲', admin: true }, member = { id: 'b', name: '乙', admin: false };
const tokenA = 'admin-test-token-at-least-24-characters', tokenB = 'member-test-token-at-least-24-characters';
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };
const op = (state, path, value) => ({ kind: 'set', path, base: readField(state, path), next: { exists: true, value } });
const submit = (service, actor, ...operations) => service.submit('default', actor, { requestId: requestId(), operations });
function fixture(t) { const service = new ProjectService(':memory:'); t.after(() => service.close()); return service; }
async function httpFixture(t, { allowedOrigins = [] } = {}) {
  const app = await createSyncServer({ members: [{ ...admin, token: tokenA }, { ...member, token: tokenB }], allowedOrigins });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(() => app.close());
  const call = async (path = '', body, token = tokenA) => {
    const response = await fetch(`${origin}/api/projects/default${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: response.status === 204 ? null : await response.json() };
  };
  const client = async (id, token = tokenA, storage = memory(), fetcher = (path, options) => fetch(origin + path, options)) => {
    const store = new Store(storage), sync = new SyncClient(store, { clientId: id, storage, fetcher, debounce: 100000, pollInterval: 100000 });
    t.after(() => { sync.stop(); store.flush(); }); await sync.connect({ token }); return sync;
  };
  return { ...app, origin, call, client };
}
test('different stale fields save independently without project-level rejection', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const result = submit(service, member, op(base, ['meta', 'introduction'], 'B'));
  assert.equal(result.state.meta.group, 'A'); assert.equal(result.state.meta.introduction, 'B'); assert.equal(result.conflicts.length, 0);
});
test('scalar conflicts preserve before/current/proposed and accept other fields in the batch', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const result = submit(service, member, op(base, ['meta', 'group'], 'B'), op(base, ['notes', '1'], 'unrelated'));
  assert.equal(result.state.meta.group, 'A'); assert.equal(result.state.notes[1], 'unrelated');
  assert.deepEqual(result.conflicts[0].base, { exists: true, value: '' }); assert.equal(result.conflicts[0].current.value, 'A'); assert.equal(result.conflicts[0].proposed.value, 'B'); assert.equal(result.conflicts[0].actorName, '乙');
  assert.equal(service.listHistory('default')[0].details[0].status, 'pending');
});
test('arrays merge by stable deduplicated union even with stale baselines and attempted removals', t => {
  const service = fixture(t), record = service.createRecord('default', admin, { requestId: requestId(), type: 'stakeholders', data: {} }).record;
  const path = ['records', record.id, 'data', 'impacts'], base = service.get('default').state;
  submit(service, admin, op(base, path, ['生命与健康', '环境']));
  const result = submit(service, member, op(base, path, ['环境', '财产与经济']));
  assert.deepEqual(readField(result.state, path).value, ['生命与健康', '环境', '财产与经济']); assert.equal(result.conflicts.length, 0);
  const removal = submit(service, member, op(result.state, path, [])); assert.deepEqual(readField(removal.state, path).value, readField(result.state, path).value);
  assert.equal(removal.revision, result.revision);
  const absent = submit(service, member, { kind: 'set', path, base: readField(removal.state, path), next: { exists: false } }); assert.deepEqual(readField(absent.state, path).value, readField(result.state, path).value);
});
test('three reflection slots remain positional scalar fields', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['reflections', '0'], 'first'));
  const result = submit(service, member, op(base, ['reflections', '1'], 'second'));
  assert.deepEqual(result.state.reflections, ['first', 'second', '']);
});
test('missing and empty values are different snapshots; equal repeated values do not conflict', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['notes', '1'], ''));
  const result = submit(service, member, op(base, ['notes', '1'], 'new'));
  assert.equal(result.conflicts.length, 1); assert.deepEqual(result.conflicts[0].base, { exists: false });
  assert.equal(submit(service, member, op(base, ['notes', '1'], '')).results[0].status, 'unchanged');
});
test('human decisions require admin permission and a fresh current-value snapshot', t => {
  const service = fixture(t), base = service.get('default').state;
  const saved = submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const conflict = submit(service, member, op(base, ['meta', 'group'], 'B')).conflicts[0];
  const body = { requestId: requestId(), expected: { exists: true, value: 'A' }, choice: 'proposed' };
  assert.throws(() => service.resolve('default', conflict.id, member, body), error => error.status === 403);
  submit(service, admin, op(saved.state, ['meta', 'group'], 'C'));
  assert.throws(() => service.resolve('default', conflict.id, admin, body), error => error.status === 409);
  assert.equal(service.conflicts('default').length, 1);
  const result = service.resolve('default', conflict.id, admin, { ...body, expected: { exists: true, value: 'C' } });
  assert.equal(result.state.meta.group, 'B'); assert.equal(result.conflicts.length, 0);
  assert.equal(service.listHistory('default')[0].kind, `resolve:${conflict.id}`);
});
test('human decisions can retain current content or explicitly enter custom content', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const pending = submit(service, member, op(base, ['meta', 'group'], 'B')).conflicts[0];
  const kept = service.resolve('default', pending.id, admin, { requestId: requestId(), expected: { exists: true, value: 'A' }, choice: 'current' }); assert.equal(kept.state.meta.group, 'A');
  const other = submit(service, member, op(base, ['meta', 'group'], 'C')).conflicts[0];
  const custom = service.resolve('default', other.id, admin, { requestId: requestId(), expected: { exists: true, value: 'A' }, choice: 'custom', value: { exists: true, value: 'agreed' } }); assert.equal(custom.state.meta.group, 'agreed');
});
test('idempotent conflict submissions and record creation never duplicate events or IDs', t => {
  const service = fixture(t), base = service.get('default').state;
  submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const body = { requestId: requestId(), operations: [op(base, ['meta', 'group'], 'B')] };
  const first = service.submit('default', member, body); assert.deepEqual(service.submit('default', member, body), first); assert.equal(service.conflicts('default').length, 1);
  assert.throws(() => service.submit('default', admin, body), error => error.status === 409);
  assert.throws(() => service.submit('default', member, { ...body, operations: [op(base, ['meta', 'group'], 'C')] }), error => error.status === 409);
  const create = { requestId: requestId(), type: 'facts', data: {} };
  const created = service.createRecord('default', admin, create); assert.deepEqual(service.createRecord('default', admin, create), created);
  assert.equal(service.get('default').state.records.length, 1);
});
test('invalid later operations roll back state, conflicts, history and request IDs atomically', t => {
  const service = fixture(t), base = service.get('default').state; submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const before = service.get('default');
  assert.throws(() => submit(service, member, op(base, ['meta', 'group'], 'B'), op(base, ['meta', 'introduction'], 'would save'), op(base, ['meta', 'unknown'], 'bad')), error => error.status === 422);
  assert.deepEqual(service.get('default'), before); assert.equal(service.conflicts('default').length, 0); assert.equal(service.listHistory('default').length, 2);
});
test('prototype paths, wrong field types, duplicate paths and malformed snapshots are rejected', t => {
  const service = fixture(t), base = service.get('default').state;
  for (const bad of [op(base, ['meta', '__proto__'], 'bad'), op(base, ['meta', 'title'], ['bad']), { ...op(base, ['meta', 'group'], 'bad'), base: { exists: false, value: '' } }]) assert.throws(() => submit(service, admin, bad), error => error.status === 422);
  const operation = op(base, ['meta', 'group'], 'A'); assert.throws(() => submit(service, admin, operation, operation), error => error.status === 422);
  assert.equal({}.polluted, undefined);
});
test('record versions increase once per accepted batch and invalidate dependent review', t => {
  const service = fixture(t); const created = service.createRecord('default', admin, { requestId: requestId(), type: 'issues', data: { title: 'issue' } });
  const store = new Store(memory()); store.state = copy(created.state); markReviewed(store, 1); store.flush();
  const review = op(created.state, ['reviewed', '1'], store.state.reviewed[1]); review.reviewState = copy(store.state); submit(service, admin, review);
  assert.equal(reviewStatus(service.get('default').state, 1), '已复核');
  const path = ['records', created.record.id, 'data', 'title']; const changed = submit(service, member, op(created.state, path, 'edited'), op(created.state, ['records', created.record.id, 'data', 'description'], 'description'));
  assert.equal(changed.state.records[0].version, 2); assert.equal(reviewStatus(changed.state, 1), '待复核');
});
test('referenced records cannot be deleted and ID counters survive restore', t => {
  const service = fixture(t); const source = service.createRecord('default', admin, { requestId: requestId(), type: 'sources' });
  service.createRecord('default', admin, { requestId: requestId(), type: 'facts', data: { sources: [source.record.id] } });
  const state = service.get('default').state;
  assert.throws(() => submit(service, admin, { kind: 'delete', path: ['records', source.record.id], base: readField(state, ['records', source.record.id]), next: { exists: false } }), /引用/);
  const old = service.getRevision('default', 1).state;
  const restored = service.replace('default', admin, { requestId: requestId(), baseRevision: service.get('default').revision, state: old, sourceRevision: 1 });
  assert.equal(restored.state.records.length, 0); assert.equal(service.createRecord('default', admin, { requestId: requestId(), type: 'sources' }).record.id, 'SRC-002');
  assert(service.listHistory('default').length >= 5);
});
test('SQLite reload preserves current content, history, pending conflicts and idempotency', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'engr-sync-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'workbench.sqlite'); let service = new ProjectService(path);
  const base = service.get('default').state; submit(service, admin, op(base, ['meta', 'group'], 'A'));
  const body = { requestId: requestId(), operations: [op(base, ['meta', 'group'], 'B')] }; const result = service.submit('default', member, body); service.close();
  service = new ProjectService(path); try { assert.equal(service.get('default').state.meta.group, 'A'); assert.equal(service.conflicts('default').length, 1); assert.equal(service.listHistory('default').length, 3); assert.deepEqual(service.submit('default', member, body), result); } finally { service.close(); }
});
test('online SQLite backup includes live WAL commits and can restore content and history', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'engr-sync-backup-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const service = new ProjectService(join(directory, 'live.sqlite'));
  try {
    const base = service.get('default').state; submit(service, admin, op(base, ['meta', 'group'], 'live commit'));
    submit(service, member, op(base, ['meta', 'group'], 'pending proposal'));
    const destination = join(directory, 'backup.sqlite'); await backup(service.db, destination);
    const restored = new ProjectService(destination);
    try { assert.equal(restored.get('default').state.meta.group, 'live commit'); assert.equal(restored.conflicts('default').length, 1); assert.equal(restored.listHistory('default').length, 3); } finally { restored.close(); }
  } finally { service.close(); }
});
test('editing a remotely deleted record is retained as a conflict rather than lost', t => {
  const service = fixture(t), created = service.createRecord('default', admin, { requestId: requestId(), type: 'issues', data: { title: 'before' } });
  submit(service, admin, { kind: 'delete', path: ['records', created.record.id], base: readField(created.state, ['records', created.record.id]), next: { exists: false } });
  const pending = submit(service, member, op(created.state, ['records', created.record.id, 'data', 'title'], 'after')).conflicts[0];
  assert.equal(pending.current.exists, false); assert.equal(pending.proposed.value, 'after');
  assert.throws(() => service.resolve('default', pending.id, admin, { requestId: requestId(), expected: { exists: false }, choice: 'proposed' }), error => error.status === 409);
  assert.equal(service.resolve('default', pending.id, admin, { requestId: requestId(), expected: { exists: false }, choice: 'current' }).conflicts.length, 0);
});
test('HTTP authentication, attribution, conditional loading and static access work', async t => {
  const { origin, call } = await httpFixture(t);
  assert.equal((await call('', undefined, '')).status, 401); assert.equal((await fetch(origin)).status, 200);
  const initial = await call(); assert.equal(initial.value.actor.name, '甲'); assert.equal((await call('?ifRevision=1')).status, 204);
  const body = { requestId: requestId(), operations: [op(initial.value.state, ['meta', 'group'], 'HTTP')] };
  assert.equal((await call('/changes', body, tokenB)).status, 200);
  assert.equal((await call('/history')).value[0].actorName, '乙');
  assert.equal((await call('/changes', { requestId: requestId(), operations: [] })).status, 422);
  assert.equal((await fetch(origin + '/api/projects/default', { headers: { Authorization: `Bearer ${tokenA}`, Origin: 'https://untrusted.example' } })).status, 403);
});

test('GitHub Pages uses the public API while local and backend pages keep same-origin requests', () => {
  assert.equal(syncApiBase({ hostname: 'ghhufue.github.io' }), PUBLIC_SYNC_API);
  for (const hostname of ['127.0.0.1', 'localhost', 'api.jixrclub.com', 'ghhufue.github.io.evil.example']) assert.equal(syncApiBase({ hostname }), '');
});

test('an explicit API origin receives authenticated reads and writes and separates its draft cache', async t => {
  const { origin, call } = await httpFixture(t);
  const store = new Store(memory());
  const sync = new SyncClient(store, { apiBase: origin + '/', clientId: 'remote-api-test', debounce: 100000, pollInterval: 100000 });
  t.after(() => { sync.stop(); store.flush(); });
  await sync.connect({ token: tokenA });
  store.setValue('meta', 'group', 'Remote API origin'); await sync.flush();
  assert.equal((await call()).value.state.meta.group, 'Remote API origin');
  assert(sync.cacheKey.includes(encodeURIComponent(origin)));
  assert.throws(() => new SyncClient(store, { apiBase: 'https://api.example.test/path' }), /来源地址/);
});

test('allowed Pages origins pass preflight but actual project requests still require authentication', async t => {
  const pages = 'https://ghhufue.github.io', { origin } = await httpFixture(t, { allowedOrigins: [pages] });
  const preflight = await fetch(origin + '/api/projects/default/changes', { method: 'OPTIONS', headers: { Origin: pages, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), pages);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  const unauthorized = await fetch(origin + '/api/projects/default', { headers: { Origin: pages } });
  assert.equal(unauthorized.status, 401); assert.equal(unauthorized.headers.get('access-control-allow-origin'), pages);
  const health = await fetch(origin + '/api/health', { headers: { Origin: pages } });
  assert.equal(health.status, 200); assert.equal(health.headers.get('access-control-allow-origin'), pages);
  const headers = { Origin: pages, Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
  const project = await (await fetch(origin + '/api/projects/default', { headers })).json();
  const written = await fetch(origin + '/api/projects/default/changes', { method: 'POST', headers, body: JSON.stringify({ requestId: requestId(), operations: [op(project.state, ['meta', 'group'], 'CORS write')] }) });
  assert.equal(written.status, 200); assert.equal(written.headers.get('access-control-allow-origin'), pages);
  assert.equal((await written.json()).state.meta.group, 'CORS write');
  for (const rejectedOrigin of ['https://ghhufue.github.io.evil.example', 'null', 'not-an-origin']) {
    const rejected = await fetch(origin + '/api/projects/default', { headers: { ...headers, Origin: rejectedOrigin } });
    assert.equal(rejected.status, 403); assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  }
  for (const extra of [{ 'Access-Control-Request-Method': 'DELETE' }, { 'Access-Control-Request-Headers': 'authorization,x-unapproved' }]) {
    assert.equal((await fetch(origin + '/api/projects/default', { method: 'OPTIONS', headers: { Origin: pages, 'Access-Control-Request-Method': 'GET', ...extra } })).status, 403);
  }
});
test('two HTTP clients sync independent fields, arrays and pending conflicts end to end', async t => {
  const { client } = await httpFixture(t), a = await client('a'), b = await client('b', tokenB);
  a.store.setValue('meta', 'group', 'A'); b.store.setValue('meta', 'introduction', 'B'); await a.flush(); await b.flush(); await a.poll();
  assert.equal(a.store.state.meta.introduction, 'B'); assert.equal(b.store.state.meta.group, 'A');
  const record = await a.createRecord('stakeholders', 1); await b.poll();
  a.store.setValue(record.id, 'impacts', ['生命与健康']); b.store.setValue(record.id, 'impacts', ['环境']); await a.flush(); await b.flush(); assert.deepEqual(b.store.get(record.id).data.impacts, ['生命与健康', '环境']);
  await a.poll(); a.store.setValue('meta', 'group', 'A2'); b.store.setValue('meta', 'group', 'B2'); await a.flush(); await b.flush();
  assert.equal(b.conflicts.length, 1); assert.equal(b.conflicts[0].proposed.value, 'B2'); await a.poll(); await a.resolve(a.conflicts[0], 'proposed', readField(a.baseState, ['meta', 'group'])); await b.poll(); assert.equal(b.store.state.meta.group, 'B2');
});
test('typing during an in-flight save preserves new input and does not self-conflict', async t => {
  const { origin, client } = await httpFixture(t); let release, reached;
  const arrived = new Promise(resolve => { reached = resolve; }); let block = true;
  const fetcher = async (path, options) => { const response = await fetch(origin + path, options); if (block && path.endsWith('/changes')) { reached(); await new Promise(resolve => { release = resolve; }); block = false; } return response; };
  const a = await client('typing', tokenA, memory(), fetcher); a.beginField(['meta', 'group']); a.store.setValue('meta', 'group', 'first');
  const saving = a.flush(); await arrived; a.store.setValue('meta', 'group', 'second'); release(); await saving;
  assert.equal(a.store.state.meta.group, 'second'); assert.equal(a.queue.size, 1); await a.flush(); assert.equal(a.conflicts.length, 0); assert.equal(a.baseState.meta.group, 'second');
});
test('polling with a dirty field preserves its first snapshot for conflict detection', async t => {
  const { client } = await httpFixture(t), a = await client('poll-a'), b = await client('poll-b', tokenB);
  b.store.setValue('meta', 'group', 'B'); a.store.setValue('meta', 'group', 'A'); await a.flush(); await b.poll();
  assert.equal(b.conflicts[0].base.value, ''); assert.equal(b.conflicts[0].current.value, 'A'); assert.equal(b.conflicts[0].proposed.value, 'B');
});
test('a field focused before a remote update uses its displayed snapshot when edited', async t => {
  const { client } = await httpFixture(t), a = await client('focus-a'), b = await client('focus-b', tokenB);
  b.beginField(['meta', 'group']); a.store.setValue('meta', 'group', 'A'); await a.flush(); await b.poll(); b.store.setValue('meta', 'group', 'B'); await b.flush();
  assert.equal(b.conflicts[0].base.value, '');
});
test('lost-response retry survives a new client and preserves later local edits', async t => {
  const { origin, client, service } = await httpFixture(t), storage = memory(); let lose = true;
  const fetcher = async (path, options) => { const response = await fetch(origin + path, options); if (lose && path.endsWith('/changes')) { lose = false; throw new Error('simulated lost response'); } return response; };
  const a = await client('reload', tokenA, storage, fetcher); a.store.setValue('meta', 'group', 'committed'); await assert.rejects(a.flush(), /lost response/);
  a.store.setValue('meta', 'introduction', 'later draft'); a.stop(); a.store.flush();
  const restored = await client('reload', tokenA, storage); await restored.flush(); await restored.flush();
  assert.equal(restored.store.state.meta.group, 'committed'); assert.equal(restored.store.state.meta.introduction, 'later draft'); assert.equal(service.listHistory('default').length, 3);
});
test('navigation is local and connecting never overwrites the offline storage key', async t => {
  const { client } = await httpFixture(t), storage = memory(), offline = new Store(storage); offline.setValue('meta', 'group', 'offline original'); offline.flush();
  const original = storage.getItem(STORAGE_KEY), sync = await client('offline', tokenA, storage);
  sync.store.state.lastRoute = 'step-6'; sync.store.save(); sync.store.flush(); assert.equal(sync.queue.size, 0); assert.equal(storage.getItem(STORAGE_KEY), original);
  sync.disconnect(); assert.equal(sync.store.state.meta.group, 'offline original');
});
test('an old idempotent response cannot roll back newer remote content after reload', async t => {
  const { origin, client, service } = await httpFixture(t), storage = memory(); let lose = true;
  const fetcher = async (path, options) => { const response = await fetch(origin + path, options); if (lose && path.endsWith('/changes')) { lose = false; throw new Error('lost response'); } return response; };
  const a = await client('old-result', tokenA, storage, fetcher); a.store.setValue('meta', 'group', 'A'); await assert.rejects(a.flush()); a.stop(); a.store.flush();
  submit(service, member, op(service.get('default').state, ['meta', 'group'], 'B newer'));
  const restored = await client('old-result', tokenA, storage); await restored.flush();
  assert.equal(restored.store.state.meta.group, 'B newer'); assert.equal(restored.revision, 3); assert.equal(JSON.parse(storage.getItem(restored.cacheKey)).inFlight, null);
});
test('dynamic issue deferral and no-gap explanations can be saved through the API', t => {
  const service = fixture(t), created = service.createRecord('default', admin, { requestId: requestId(), type: 'issues' });
  const result = submit(service, admin, op(created.state, ['records', created.record.id, 'data', 'deferredReason'], 'Needs further evidence'), op(created.state, ['stepData', '3', 'noGapsReason'], 'Checked available material'));
  assert.equal(result.state.records[0].data.deferredReason, 'Needs further evidence'); assert.equal(result.state.stepData[3].noGapsReason, 'Checked available material');
});
test('snapshot comparison is structural and mutation cannot alter captured bases', () => {
  assert(equal({ a: 1, b: 2 }, { b: 2, a: 1 }));
  const store = new Store(memory()), before = copy(store.state); store.setValue('meta', 'group', 'A'); const operations = changes(before, store.state); store.state.meta.group = 'B'; assert.equal(operations[0].next.value, 'A'); store.flush();
});
