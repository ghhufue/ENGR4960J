import { parseBackup, RECORD_TYPES } from '../src/js/core/store.js';
import { STEPS } from '../src/js/features/analysis/index.js';
import { sourceSection } from '../src/js/features/sources.js';
import { memberSection, iterationSection } from '../src/js/features/reflection.js';
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function requireThat(condition, message, status = 422) { if (!condition) throw new ApiError(status, message); }
const keys = fields => new Set(fields.flatMap(field => [field.key, `${field.key}Other`]));
const sections = [...STEPS.flatMap(step => step.sections), sourceSection, memberSection, iterationSection];
const typeKeys = new Map(RECORD_TYPES.map(type => [type, new Set(sections.filter(section => section.type === type).flatMap(section => [...keys(section.fields)]))]));
for (const [type, extra] of Object.entries({ issues: ['deferredReason'], gaps: ['resolvedFacts'], reviews: ['results'] })) extra.forEach(key => typeKeys.get(type).add(key));
const stepKeys = new Map(STEPS.map(step => [String(step.number), keys(step.fields || [])]));
stepKeys.get('3').add('noGapsReason'); stepKeys.get('4').add('noAssumptionsReason');
export function validatePath(state, path, kind = 'set') {
  requireThat(Array.isArray(path) && path.length > 0 && path.length <= 4 && path.every(key => typeof key === 'string' && key.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(key)), '无效字段路径。');
  const [root, id, part, field] = path;
  if (root === 'records') {
    const record = state.records.find(item => item.id === id); requireThat(record, '记录已删除或不存在。', 409);
    requireThat(kind === 'delete' && path.length === 2 || kind === 'set' && (path.length === 3 && part === 'archived' || path.length === 4 && part === 'data' && typeKeys.get(record.type).has(field)), '不可修改该记录字段。');
  } else {
    requireThat(kind === 'set', '无效操作类型。');
    const valid = root === 'meta' && path.length === 2 && ['title', 'group', 'date', 'introduction', 'aiStatement', 'principlesComplete'].includes(id)
      || ['notes', 'reviewed'].includes(root) && path.length === 2 && /^(?:[1-9]|10)$/.test(id)
      || root === 'reflections' && path.length === 2 && /^[0-2]$/.test(id)
      || root === 'stepData' && path.length === 3 && stepKeys.get(id)?.has(part)
      || root === 'focusAnalyses' && path.length === 3 && state.records.some(record => record.id === id && record.type === 'issues') && stepKeys.get('2').has(part)
      || root === 'focusId' && path.length === 1;
    requireThat(valid, '不可修改该项目字段。');
  }
}
export function validateSnapshot(value) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value) && typeof value.exists === 'boolean' && Object.keys(value).every(key => ['exists', 'value'].includes(key)) && value.exists === Object.hasOwn(value, 'value'), '字段快照格式无效。');
  if (value.exists) requireThat(JSON.stringify(value.value).length <= 1024 * 1024, '单个字段超过 1 MB。');
}
export function validateState(state) {
  try { parseBackup(JSON.stringify(state)); } catch (error) { throw new ApiError(422, error.message); }
  requireThat(state.records.length <= 10000, '项目记录过多。');
  for (const path of (function* () {
    for (const record of state.records) for (const key of Object.keys(record.data)) yield ['records', record.id, 'data', key];
    for (const [step, data] of Object.entries(state.stepData)) for (const key of Object.keys(data)) yield ['stepData', step, key];
    for (const [id, data] of Object.entries(state.focusAnalyses)) for (const key of Object.keys(data)) yield ['focusAnalyses', id, key];
  })()) validatePath(state, path);
  requireThat(!state.focusId || state.records.some(record => record.id === state.focusId && record.type === 'issues'), '分析焦点必须是有效问题记录。');
  return state;
}
