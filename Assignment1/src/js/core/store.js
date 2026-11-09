export const STORAGE_KEY = 'engr4960j.ethics-workbench.v1';
export const RECORD_TYPES = ['issues', 'stakeholders', 'facts', 'gaps', 'assumptions', 'terms', 'principles', 'conflicts', 'reviews', 'solutions', 'constraints', 'future', 'sources', 'members', 'iterations'];
export const TYPE_STEPS = { issues: 1, stakeholders: 1, facts: 3, gaps: 3, assumptions: 4, terms: 5, principles: 6, conflicts: 6, reviews: 7, solutions: 8, constraints: 9, future: 10 };
const prefixes = { issues: 'ISS', stakeholders: 'STK', facts: 'FCT', gaps: 'GAP', assumptions: 'ASM', terms: 'TRM', principles: 'PRN', conflicts: 'CFL', reviews: 'REV', solutions: 'SOL', constraints: 'CST', future: 'FUT', sources: 'SRC', members: 'MEM', iterations: 'ITR' };
export function freshState() {
  return { schemaVersion: 1, meta: { title: '挑战者号航天飞机事故', group: '', date: '', introduction: '', aiStatement: '', principlesComplete: false }, records: [], counters: {}, notes: {}, stepData: {}, focusId: '', focusAnalyses: {}, reflections: ['', '', ''], reviewed: {}, updatedAt: new Date().toISOString(), lastRoute: 'overview' };
}
function assertPlain(value, depth = 0) {
  if (depth > 25) throw new Error('备份数据嵌套层数过多。');
  if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return;
  if (Array.isArray(value)) { value.forEach(item => assertPlain(item, depth + 1)); return; }
  if (typeof value !== 'object') throw new Error('备份包含不支持的数据类型。');
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('备份包含无效的字段名称。');
    assertPlain(item, depth + 1);
  }
}
export function parseBackup(text) {
  if (text.length > 5 * 1024 * 1024) throw new Error('备份超过 5 MB，请检查文件。');
  const value = JSON.parse(text); assertPlain(value);
  if (value.schemaVersion !== 1 || !value.meta || typeof value.meta.title !== 'string' || !Array.isArray(value.records) || !Array.isArray(value.reflections) || value.reflections.length !== 3) throw new Error('这不是兼容的工作台项目备份。');
  for (const key of ['counters', 'notes', 'stepData', 'focusAnalyses', 'reviewed']) if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error(`备份缺少 ${key} 数据。`);
  if (typeof value.focusId !== 'string' || value.reflections.some(item => typeof item !== 'string')) throw new Error('备份中的焦点或反思数据无效。');
  for (const key of ['group', 'date', 'introduction', 'aiStatement']) if (typeof value.meta[key] !== 'string') throw new Error('备份中的案例资料无效。');
  if (typeof value.meta.principlesComplete !== 'boolean') throw new Error('备份中的原则清单状态无效。');
  const referenceKeys = new Set(['sources', 'evidence', 'stakeholders', 'issues', 'gaps', 'replacement', 'related', 'principles', 'priority', 'owners', 'members', 'results', 'solutions', 'constraints', 'resolvedFacts']);
  const listKeys = new Set([...referenceKeys, 'directions', 'impacts', 'consequenceTypes', 'shortTypes', 'longTypes', 'otherReasons', 'basisTypes', 'actions', 'effects', 'engineeringTypes', 'governanceTypes', 'otherTypes']);
  const validateData = data => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('分析字段结构无效。');
    for (const [key, item] of Object.entries(data)) {
      if (listKeys.has(key) && !Array.isArray(item)) throw new Error('关联记录与多选答案必须是列表。');
      if (!listKeys.has(key) && typeof item !== 'string') throw new Error('文字或单选字段必须是文字。');
      if (!(typeof item === 'string' || Array.isArray(item) && item.every(entry => typeof entry === 'string'))) throw new Error('分析字段必须是文字或选项列表。');
      if (['title', 'description', 'statement', 'impact', 'definition', 'clarification', 'relevance', 'category', 'status', 'verification', 'progress'].includes(key) && typeof item !== 'string') throw new Error('文字字段结构无效。');
    }
  };
  Object.values(value.stepData).forEach(validateData); Object.values(value.focusAnalyses).forEach(validateData);
  if (Object.values(value.notes).some(item => typeof item !== 'string') || Object.values(value.counters).some(item => !Number.isInteger(item) || item < 0) || Object.values(value.reviewed).some(item => !item || typeof item.fingerprint !== 'string' || typeof item.at !== 'string')) throw new Error('备份中的说明、计数或复核数据无效。');
  const ids = new Set();
  for (const record of value.records) {
    if (!RECORD_TYPES.includes(record.type) || typeof record.id !== 'string' || !record.id || ids.has(record.id) || !record.data || typeof record.data !== 'object' || Array.isArray(record.data) || !Number.isInteger(record.version) || record.version < 1 || typeof record.archived !== 'boolean' || !Number.isInteger(record.originStep) || record.originStep < 0 || record.originStep > 10) throw new Error('备份包含重复或格式错误的记录。');
    ids.add(record.id);
    if (!/^[A-Z]{3}-\d{3,}$/.test(record.id)) throw new Error('记录编号格式无效。');
    validateData(record.data);
  }
  return value;
}
export class Store {
  constructor(storage = null) {
    this.storage = storage; this.storageKey = STORAGE_KEY; this.state = freshState(); this.saveStatus = 'idle'; this.savedAt = ''; this.error = ''; this.listeners = new Set();
    try { this.recoveryRaw = storage?.getItem(STORAGE_KEY); if (this.recoveryRaw) { this.state = parseBackup(this.recoveryRaw); this.savedAt = this.state.updatedAt; this.saveStatus = 'saved'; this.recoveryRaw = ''; } } catch (error) { this.error = `无法恢复本地内容：${error.message}。原存储未覆盖，请先导出或检查。`; this.saveStatus = 'failed'; this.recoveryBlocked = true; }
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { this.listeners.forEach(listener => listener(this)); }
  save() {
    this.state.updatedAt = new Date().toISOString(); this.saveStatus = 'saving'; this.emit();
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 200);
  }
  flush() {
    clearTimeout(this.timer);
    try {
      if (this.recoveryBlocked) throw new Error('原本地内容恢复失败，已停止覆盖；导入有效备份或新建项目后再保存');
      if (!this.storage) throw new Error('浏览器存储不可用');
      this.storage.setItem(this.storageKey, JSON.stringify(this.state)); this.saveStatus = 'saved'; this.savedAt = this.state.updatedAt; this.error = '';
    } catch (error) { this.saveStatus = 'failed'; this.error = `保存失败：${error.message}。请导出项目备份，当前内容仍在页面中。`; }
    this.emit();
  }
  records(type, includeArchived = false) { return this.state.records.filter(record => record.type === type && (includeArchived || !record.archived)); }
  get(id) { return this.state.records.find(record => record.id === id); }
  add(type, originStep = TYPE_STEPS[type] || 0, data = {}) {
    if (!RECORD_TYPES.includes(type)) throw new Error('未知记录类型。');
    let next = this.state.counters[type] || 0; let id;
    do { id = `${prefixes[type]}-${String(++next).padStart(3, '0')}`; } while (this.get(id));
    this.state.counters[type] = next;
    const defaults = { facts: { verification: '未核查' }, gaps: { progress: '待调查' }, assumptions: { status: '待核查' }, reviews: { status: '待处理' }, solutions: { status: '候选' }, constraints: { status: '待处理' }, sources: { verification: '未核查', intended: '待决定', cited: '待核对' } };
    const record = { id, type, originStep, data: { ...(defaults[type] || {}), ...data }, version: 1, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.state.records.push(record); this.save(); return record;
  }
  update(id, key, value) { const record = this.get(id); if (!record) return; if (JSON.stringify(record.data[key]) === JSON.stringify(value)) return; record.data[key] = value; record.version++; record.updatedAt = new Date().toISOString(); this.save(); }
  archive(id, archived = true) { const record = this.get(id); if (record) { record.archived = archived; record.version++; this.save(); } }
  referencesTo(id) { return this.state.records.filter(record => Object.values(record.data).some(value => Array.isArray(value) ? value.includes(id) : value === id)); }
  remove(id) {
    if (this.referencesTo(id).length || this.state.focusId === id || Object.keys(this.state.focusAnalyses).includes(id) || Object.values(this.state.focusAnalyses).some(data => Object.values(data).some(value => Array.isArray(value) ? value.includes(id) : value === id))) throw new Error('该记录仍被引用，或保存在焦点历史中；请保留归档记录或先移除关联。');
    this.state.records = this.state.records.filter(record => record.id !== id); this.save();
  }
  focusData() { return this.state.focusAnalyses[this.state.focusId] || {}; }
  setFocus(id) { this.state.focusId = id; if (id && !this.state.focusAnalyses[id]) this.state.focusAnalyses[id] = {}; this.save(); }
  setValue(target, key, value) {
    if (target === 'meta') this.state.meta[key] = value;
    else if (target === 'focus') { if (!this.state.focusId) return; this.state.focusAnalyses[this.state.focusId][key] = value; }
    else if (target === 'notes') this.state.notes[key] = value;
    else if (target === 'reflections') this.state.reflections[Number(key)] = value;
    else if (target.startsWith('step:')) { const step = target.slice(5); this.state.stepData[step] ||= {}; this.state.stepData[step][key] = value; }
    else { this.update(target, key, value); return; }
    this.save();
  }
  replace(state) { this.state = state; this.recoveryBlocked = false; this.recoveryRaw = ''; this.save(); }
}
