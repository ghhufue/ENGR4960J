import { copy, equal, changes, pathKey, readField, writeField, requestId } from './sync-protocol.js';
import { STORAGE_KEY, freshState, parseBackup } from './store.js';
export class SyncClient {
  constructor(store, { apiBase = '', fetcher = (...args) => fetch(...args), storage = store.storage, clientId = requestId(), onState = () => {}, onStatus = () => {}, debounce = 900, pollInterval = 2500 } = {}) {
    this.apiBase = apiBase.replace(/\/+$/, '');
    if (this.apiBase) { const url = new URL(this.apiBase); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== this.apiBase) throw new Error('同步服务地址必须是 HTTP 或 HTTPS 来源地址。'); }
    this.store = store; this.fetcher = fetcher; this.storage = storage; this.clientId = clientId; this.onState = onState; this.onStatus = onStatus; this.debounce = debounce; this.pollInterval = pollInterval;
    this.status = 'disconnected'; this.enabled = false; this.queue = new Map(); this.editBases = new Map(); this.inFlight = null; this.conflicts = []; this.observed = copy(store.state); this.revision = 0; this.epoch = 0;
    this.unsubscribe = store.subscribe(() => this.observe());
  }
  setStatus(status, error = '') { this.status = status; this.error = error; this.onStatus(this); }
  async request(resource = '', body, method = body ? 'POST' : 'GET') {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await this.fetcher(`${this.apiBase}/api/projects/${this.projectId}${resource}`, { method, credentials: 'omit', headers: { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
      if (response.status === 204) return null;
      const value = await response.json(); if (!response.ok) { const error = new Error(value.error || `HTTP ${response.status}`); error.status = response.status; throw error; } return value;
    } finally { clearTimeout(timeout); }
  }
  persist() {
    try { this.storage?.setItem(this.cacheKey, JSON.stringify({ revision: this.revision, baseState: this.baseState, workingState: this.store.state, queue: [...this.queue], inFlight: this.inFlight })); }
    catch (error) { this.cacheError = error.message; this.onStatus(this); }
  }
  observe() {
    if (!this.enabled || this.applying) return;
    for (const op of changes(this.observed, this.store.state)) {
      const key = pathKey(op.path), previous = this.queue.get(key);
      const sent = this.inFlight?.resource === '/changes' ? this.inFlight.body.operations.find(item => pathKey(item.path) === key) : null;
      if (previous) op.base = previous.base; else if (sent) op.base = copy(sent.next); else if (this.editBases.has(key)) op.base = copy(this.editBases.get(key));
      if (op.kind === 'delete') for (const [queuedKey, queued] of this.queue) if (queued.path[0] === 'records' && queued.path[1] === op.path[1]) this.queue.delete(queuedKey);
      if (op.path[0] === 'reviewed' && op.next.exists) op.reviewState = copy(this.store.state);
      if (equal(op.base, op.next)) this.queue.delete(key); else this.queue.set(key, op);
    }
    this.observed = copy(this.store.state); this.persist();
    if (this.queue.size) { this.setStatus('pending'); clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.flush().catch(() => {}), this.debounce); }
  }
  apply(project) {
    if (project.revision < this.revision) return;
    this.revision = project.revision; this.baseState = copy(project.state); this.conflicts = project.conflicts || [];
    const working = copy(project.state); working.lastRoute = this.store.state.lastRoute;
    // Replay local intentions, never change their captured base snapshots.
    if (this.inFlight?.resource === '/changes') for (const op of this.inFlight.body.operations) writeField(working, op.path, op.next);
    for (const op of this.queue.values()) writeField(working, op.path, op.next);
    this.applying = true;
    try { this.store.state = working; this.observed = copy(working); this.store.save(); } finally { this.applying = false; }
    this.persist(); this.onState(this);
  }
  async connect({ projectId = 'default', token = '' } = {}) {
    if (this.enabled || this.running) throw new Error('请先断开当前连接。');
    if (!/^[\w-]{1,64}$/.test(projectId)) throw new Error('项目编号无效。');
    this.projectId = projectId; this.token = token; this.setStatus('connecting');
    try {
      const project = await this.request(); this.actor = project.actor;
      this.cacheKey = `engr4960j.sync.${this.apiBase ? `${encodeURIComponent(this.apiBase)}.` : ''}${projectId}.${this.actor.id}.${this.clientId}`;
      let cached; try { cached = JSON.parse(this.storage?.getItem(this.cacheKey) || 'null'); } catch { throw new Error('同步草稿缓存无法读取，请先导出检查。'); }
      this.queue = new Map(cached?.queue || []); this.inFlight = cached?.inFlight || null;
      if (cached?.workingState) { parseBackup(JSON.stringify(cached.workingState)); this.store.state = cached.workingState; }
      this.store.storageKey = `${this.cacheKey}.workbench`; this.revision = 0; this.enabled = true; this.epoch++;
      this.apply(project); this.setStatus(this.queue.size || this.inFlight ? 'pending' : this.conflicts.length ? 'conflict' : 'synced');
      if (this.inFlight || this.queue.size) this.flush().catch(() => {});
      this.schedulePoll(); return project;
    } catch (error) { this.enabled = false; this.setStatus('disconnected', error.message); throw error; }
  }
  schedulePoll() {
    clearTimeout(this.pollTimer);
    if (this.enabled) this.pollTimer = setTimeout(async () => { try { await this.poll(); } catch {} this.schedulePoll(); }, typeof document !== 'undefined' && document.hidden ? this.pollInterval * 4 : this.pollInterval);
  }
  async poll() {
    if (!this.enabled || this.running || this.status === 'blocked') return;
    const epoch = this.epoch;
    try {
      const result = await this.request(`?ifRevision=${this.revision}`); if (!this.enabled || this.epoch !== epoch) return;
      if (result) this.apply(result);
      if (this.queue.size || this.inFlight) await this.flush(); else this.setStatus(this.conflicts.length ? 'conflict' : 'synced');
    } catch (error) { this.setStatus('offline', error.message); throw error; }
  }
  async flush() {
    clearTimeout(this.saveTimer);
    if (!this.enabled) throw new Error('项目尚未连接。');
    if (this.status === 'blocked') throw new Error(this.error || '请先处理被拒绝的提交。');
    if (this.running) { await this.running; return this.flush(); }
    if (!this.inFlight && !this.queue.size) return;
    if (!this.inFlight) {
      const operations = [...this.queue.values()].slice(0, 500); operations.forEach(op => this.queue.delete(pathKey(op.path)));
      this.inFlight = { resource: '/changes', body: { requestId: requestId(), operations: copy(operations) } }; this.persist();
    }
    const epoch = this.epoch, sent = this.inFlight; this.setStatus('syncing');
    this.running = (async () => {
      try {
        const result = await this.request(sent.resource, sent.body);
        if (!this.enabled || epoch !== this.epoch) return;
        this.inFlight = null;
        if (sent.resource === '/changes') for (const op of sent.body.operations) if (this.editBases.has(pathKey(op.path))) {
          const pending = result.results.find(item => equal(item.path, op.path))?.status === 'pending';
          this.editBases.set(pathKey(op.path), pending ? copy(op.next) : readField(result.state, op.path));
        }
        this.apply(result.revision < this.revision ? { revision: this.revision, state: this.baseState, conflicts: this.conflicts } : result);
        this.setStatus(this.queue.size ? 'pending' : this.conflicts.length ? 'conflict' : 'synced');
        return result;
      } catch (error) {
        if (error.status && error.status < 500 && sent.resource !== '/changes') { this.inFlight = null; this.persist(); this.setStatus(this.conflicts.length ? 'conflict' : 'synced', error.message); }
        else { this.persist(); this.setStatus(error.status && error.status < 500 ? 'blocked' : 'offline', error.message); }
        throw error;
      }
    })();
    let result;
    try { result = await this.running; } finally { this.running = null; }
    if (this.queue.size) { clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.flush().catch(() => {}), this.debounce); }
    return result;
  }
  async command(resource, body) {
    if (this.commandRunning) throw new Error('请等待当前操作完成。');
    this.commandRunning = true;
    try {
      await this.flush();
      if (this.inFlight || this.queue.size) throw new Error('请等待已有修改同步完成。');
      this.inFlight = { resource, body: { ...body, requestId: requestId() } }; this.persist(); return await this.flush();
    } finally { this.commandRunning = false; }
  }
  beginField(path) { if (this.enabled) this.editBases.set(pathKey(path), readField(this.store.state, path)); }
  endField(path) { this.editBases.delete(pathKey(path)); }
  discardFailed() {
    if (this.status !== 'blocked' || this.running) throw new Error('当前没有可放弃的失败提交。');
    this.inFlight = null; this.queue.clear(); this.editBases.clear(); this.apply({ revision: this.revision, state: this.baseState, conflicts: this.conflicts }); this.setStatus(this.conflicts.length ? 'conflict' : 'synced');
  }
  async createRecord(type, originStep, data = {}) { const result = await this.command('/records', { type, originStep, data }); return this.store.get(result.record.id); }
  async resolve(conflict, choice, expected, value) { return this.command(`/conflicts/${conflict.id}/resolve`, { choice, expected, ...(value ? { value } : {}) }); }
  async replace(state, sourceRevision) {
    while (this.inFlight || this.queue.size) await this.flush();
    return this.command('/replace', { state, baseRevision: this.revision, sourceRevision });
  }
  disconnect() {
    if (this.running || this.inFlight || this.queue.size) throw new Error('仍有未提交内容，请先恢复网络并同步，或导出草稿。');
    this.enabled = false; this.epoch++; clearTimeout(this.pollTimer); clearTimeout(this.saveTimer); this.store.flush(); this.store.storageKey = STORAGE_KEY;
    const raw = this.storage?.getItem(STORAGE_KEY); this.store.state = raw ? parseBackup(raw) : freshState(); this.observed = copy(this.store.state); this.conflicts = []; this.token = ''; this.setStatus('disconnected'); this.onState(this);
  }
  stop() { clearTimeout(this.pollTimer); clearTimeout(this.saveTimer); this.unsubscribe(); }
}
