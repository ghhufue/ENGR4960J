import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { Store, freshState, RECORD_TYPES } from '../src/js/core/store.js';
import { fingerprint } from '../src/js/core/review.js';
import { copy, equal, readField, writeField, mergeField } from '../src/js/core/sync-protocol.js';
import { ApiError, requireThat, validatePath, validateSnapshot, validateState } from './validation.mjs';
const now = () => new Date().toISOString();
function reviewContent(state, step) {
  const content = JSON.parse(fingerprint(state, step));
  content[0] = content[0].map(([id]) => { const record = state.records.find(item => item.id === id); return [id, record.data, record.archived]; });
  return content;
}
export class ProjectService {
  constructor(filename) {
    this.db = new DatabaseSync(filename, { timeout: 5000 });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (project_id TEXT NOT NULL REFERENCES projects(id), revision INTEGER NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, kind TEXT NOT NULL, detail_json TEXT NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(project_id,revision));
      CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), path_json TEXT NOT NULL, base_json TEXT NOT NULL, current_json TEXT NOT NULL, proposed_json TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, resolution_json TEXT);
      CREATE INDEX IF NOT EXISTS conflicts_project_status ON conflicts(project_id,status);
      CREATE TABLE IF NOT EXISTS requests (project_id TEXT NOT NULL REFERENCES projects(id), request_id TEXT NOT NULL, actor_id TEXT NOT NULL, hash TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY(project_id, request_id));`);
    if (!this.db.prepare('SELECT id FROM projects WHERE id=?').get('default')) {
      const state = freshState(); this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare('INSERT INTO projects VALUES (?,?,?)').run('default', 1, JSON.stringify(state));
        this.history('default', 1, state, { id: 'system', name: '系统' }, 'initialize', []); this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    }
  }
  close() { this.db.close(); }
  get(id) { const row = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id); requireThat(row, '项目不存在。', 404); return { projectId: id, revision: row.revision, state: JSON.parse(row.state_json) }; }
  conflicts(id) {
    this.get(id);
    return this.db.prepare("SELECT * FROM conflicts WHERE project_id=? AND status='pending' ORDER BY created_at,id").all(id).map(row => ({ id: row.id, path: JSON.parse(row.path_json), base: JSON.parse(row.base_json), current: JSON.parse(row.current_json), proposed: JSON.parse(row.proposed_json), actorId: row.actor_id, actorName: row.actor_name, status: row.status, createdAt: row.created_at }));
  }
  history(id, revision, state, actor, kind, details) { this.db.prepare('INSERT INTO history VALUES (?,?,?,?,?,?,?,?)').run(id, revision, actor.id, actor.name, kind, JSON.stringify(details), JSON.stringify(state), now()); }
  listHistory(id, before = Number.MAX_SAFE_INTEGER, limit = 30) {
    this.get(id);
    return this.db.prepare('SELECT revision,actor_id AS actorId,actor_name AS actorName,kind,detail_json,created_at AS createdAt FROM history WHERE project_id=? AND revision<? ORDER BY revision DESC LIMIT ?').all(id, before, limit).map(({ detail_json, ...row }) => ({ ...row, details: JSON.parse(detail_json) }));
  }
  getRevision(id, revision) { this.get(id); const row = this.db.prepare('SELECT state_json FROM history WHERE project_id=? AND revision=?').get(id, revision); requireThat(row, '历史版本不存在。', 404); return { projectId: id, revision, state: JSON.parse(row.state_json) }; }
  mutate(id, actor, body, kind, action) {
    requireThat(body && typeof body.requestId === 'string' && /^[\w-]{8,100}$/.test(body.requestId), '缺少有效 requestId。');
    const hash = createHash('sha256').update(JSON.stringify({ kind, body })).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.db.prepare('SELECT * FROM requests WHERE project_id=? AND request_id=?').get(id, body.requestId);
      if (previous) {
        requireThat(previous.actor_id === actor.id && previous.hash === hash, 'requestId 已被其他请求使用。', 409);
        this.db.exec('COMMIT'); return JSON.parse(previous.response_json);
      }
      const project = this.get(id), details = [], touched = new Set();
      const result = action(project.state, details, touched) || {};
      for (const record of project.state.records) if (touched.has(record.id)) { record.version++; record.updatedAt = now(); }
      if (result.reviews) for (const { step, reviewState } of result.reviews) {
        requireThat(equal(reviewContent(project.state, step), reviewContent(reviewState, step)), '复核依据已变化，请重新检查后复核。', 409);
        project.state.reviewed[step] = { fingerprint: fingerprint(project.state, step), at: now() };
      }
      validateState(project.state);
      if (details.length) {
        project.revision++; project.state.updatedAt = now();
        this.db.prepare('UPDATE projects SET revision=?,state_json=? WHERE id=?').run(project.revision, JSON.stringify(project.state), id);
        this.history(id, project.revision, project.state, actor, kind, details);
      }
      const response = { ...project, conflicts: this.conflicts(id), results: result.results || [], ...(result.record ? { record: result.record } : {}) };
      this.db.prepare('INSERT INTO requests VALUES (?,?,?,?,?)').run(id, body.requestId, actor.id, hash, JSON.stringify(response));
      this.db.exec('COMMIT'); return response;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  submit(id, actor, body) {
    requireThat(Array.isArray(body.operations) && body.operations.length > 0 && body.operations.length <= 500, '每次提交需要 1–500 个字段操作。');
    return this.mutate(id, actor, body, 'fields', (state, details, touched) => {
      const results = [], reviews = [], paths = new Set();
      for (const op of body.operations) {
        requireThat(op && ['set', 'delete'].includes(op.kind), '无效字段操作。');
        const missingRecord = Array.isArray(op.path) && op.path[0] === 'records' && !state.records.some(record => record.id === op.path[1]);
        let validationState = state;
        if (missingRecord) {
          const rows = this.db.prepare('SELECT state_json FROM history WHERE project_id=? ORDER BY revision DESC').all(id);
          const previous = rows.map(row => JSON.parse(row.state_json).records.find(record => record.id === op.path[1])).find(Boolean);
          requireThat(previous, '记录不存在。', 404); validationState = copy(state); validationState.records.push(previous);
        }
        validatePath(validationState, op.path, op.kind); validateSnapshot(op.base); validateSnapshot(op.next);
        const key = JSON.stringify(op.path); requireThat(!paths.has(key), '同一批次不能重复修改同一字段。'); paths.add(key);
        if (op.kind === 'delete') requireThat(!op.next.exists && op.base.exists, '删除必须提供原记录快照。');
        // Reject malformed proposed values even if they would only create a conflict.
        const proposed = copy(validationState); writeField(proposed, op.path, op.next); validateState(proposed);
        const current = readField(state, op.path);
        let merged = missingRecord && op.next.exists ? { status: 'conflict', value: current } : mergeField(current, op.base, op.next);
        if (op.path[0] === 'reviewed' && merged.status !== 'conflict' && op.next.exists) {
          requireThat(op.reviewState, '人工复核缺少依据快照。'); validateState(op.reviewState);
          const step = Number(op.path[1]);
          requireThat(op.next.value.fingerprint === fingerprint(op.reviewState, step), '复核指纹与依据不匹配。');
          reviews.push({ step, reviewState: op.reviewState });
        }
        if (merged.status !== 'conflict' && op.kind === 'delete') {
          const store = new Store(); store.state = copy(state);
          try { store.remove(op.path[1]); } catch (error) { throw new ApiError(422, error.message); } finally { clearTimeout(store.timer); }
        }
        if (merged.status === 'conflict') {
          const conflictId = randomUUID();
          this.db.prepare('INSERT INTO conflicts VALUES (?,?,?,?,?,?,?,?,?,?,NULL)').run(conflictId, id, key, JSON.stringify(op.base), JSON.stringify(current), JSON.stringify(op.next), actor.id, actor.name, 'pending', now());
          details.push({ path: op.path, status: 'pending', conflictId, base: op.base, current, proposed: op.next }); results.push({ path: op.path, status: 'pending', conflictId });
        } else {
          if (!equal(current, merged.value)) {
            writeField(state, op.path, merged.value);
            if (op.path[0] === 'records' && op.kind === 'set') touched.add(op.path[1]);
            if (op.path[0] === 'focusId' && merged.value.value) state.focusAnalyses[merged.value.value] ||= {};
            details.push({ path: op.path, status: merged.status, before: current, after: merged.value });
          }
          results.push({ path: op.path, status: merged.status });
        }
      }
      return { results, reviews };
    });
  }
  createRecord(id, actor, body) {
    requireThat(RECORD_TYPES.includes(body.type), '未知记录类型。');
    return this.mutate(id, actor, body, 'create', (state, details) => {
      const store = new Store(); store.state = state;
      let record; try { record = store.add(body.type, body.originStep, body.data || {}); } finally { clearTimeout(store.timer); }
      validateState(state); details.push({ path: ['records', record.id], status: 'created', after: { exists: true, value: copy(record) } }); return { record };
    });
  }
  resolve(id, conflictId, actor, body) {
    requireThat(actor.admin, '仅管理成员可裁定冲突。', 403);
    validateSnapshot(body.expected); requireThat(['current', 'proposed', 'custom'].includes(body.choice), '请选择裁定结果。');
    return this.mutate(id, actor, body, `resolve:${conflictId}`, (state, details, touched) => {
      const row = this.db.prepare('SELECT * FROM conflicts WHERE id=? AND project_id=?').get(conflictId, id);
      requireThat(row && row.status === 'pending', '冲突不存在或已经裁定。', 409);
      const path = JSON.parse(row.path_json);
      const current = readField(state, path); requireThat(equal(current, body.expected), '字段在裁定期间又发生变化，请加载最新内容后裁定。', 409);
      const missingRecord = path[0] === 'records' && !state.records.some(record => record.id === path[1]);
      requireThat(!missingRecord || body.choice === 'current', '该记录已删除。可保留删除结果，或先从历史恢复记录再裁定。', 409);
      if (!missingRecord) validatePath(state, path, path.length === 2 && path[0] === 'records' ? 'delete' : 'set');
      const selected = body.choice === 'current' ? current : body.choice === 'proposed' ? JSON.parse(row.proposed_json) : body.value;
      validateSnapshot(selected);
      if (path[0] === 'records' && path.length === 2) requireThat(!selected.exists || equal(current, selected), '裁定不能直接替换整条记录。');
      if (path[0] === 'records' && path.length === 2 && !selected.exists) {
        const store = new Store(); store.state = copy(state); try { store.remove(path[1]); } catch (error) { throw new ApiError(422, error.message); } finally { clearTimeout(store.timer); }
      }
      // An array can be edited deliberately through this explicit human decision.
      writeField(state, path, selected); validateState(state);
      if (path[0] === 'records' && path.length > 2 && !equal(current, selected)) touched.add(path[1]);
      if (path[0] === 'focusId' && selected.value) state.focusAnalyses[selected.value] ||= {};
      if (path[0] === 'reviewed' && selected.exists) state.reviewed[path[1]].fingerprint = 'manual-resolution-requires-review';
      this.db.prepare("UPDATE conflicts SET status='resolved',resolution_json=? WHERE id=?").run(JSON.stringify({ actorId: actor.id, choice: body.choice, before: current, after: selected, at: now() }), conflictId);
      details.push({ path, conflictId, status: 'resolved', before: current, after: selected });
    });
  }
  replace(id, actor, body) {
    requireThat(actor.admin, '仅管理成员可导入或恢复项目。', 403);
    return this.mutate(id, actor, body, 'replace', (state, details) => {
      requireThat(body.baseRevision === this.get(id).revision, '项目已变化，请重新加载再导入或恢复。', 409);
      const next = copy(body.state); validateState(next);
      // Keep every previously issued ID reserved, including deleted records.
      for (const type of RECORD_TYPES) next.counters[type] = Math.max(next.counters[type] || 0, state.counters[type] || 0, ...next.records.filter(record => record.type === type).map(record => Number(record.id.split('-')[1])));
      for (const record of next.records) {
        const old = state.records.find(item => item.id === record.id);
        requireThat(!old || old.type === record.type, '导入不能改变已有编号的记录类型。');
        record.version = Math.max(record.version, old?.version || 0) + 1; record.updatedAt = now();
      }
      next.reviewed = {}; next.lastRoute = 'overview'; Object.assign(state, next); details.push({ status: 'replaced', sourceRevision: body.sourceRevision || null });
    });
  }
}
