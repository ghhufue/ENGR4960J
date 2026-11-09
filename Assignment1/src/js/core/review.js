import { TYPE_STEPS } from './store.js';
const owned = { 1: ['issues', 'stakeholders'], 2: [], 3: ['facts', 'gaps'], 4: ['assumptions'], 5: ['terms'], 6: ['principles', 'conflicts'], 7: ['reviews'], 8: ['solutions'], 9: ['constraints'], 10: ['future'] };
export function fingerprint(state, step) {
  const records = state.records.filter(record => owned[step].includes(record.type) && (record.type !== 'issues' || record.originStep === 1) || step === 7 && record.type === 'issues' && record.originStep === 7);
  const ids = new Set(records.map(record => record.id));
  const scan = data => { for (const value of Object.values(data)) for (const item of Array.isArray(value) ? value : [value]) if (typeof item === 'string' && state.records.some(record => record.id === item)) ids.add(item); };
  records.forEach(record => scan(record.data));
  if (step === 2) { ids.add(state.focusId); scan(state.focusAnalyses[state.focusId] || {}); }
  if (step === 6) state.records.filter(record => record.type === 'principles').forEach(record => ids.add(record.id));
  if (step === 7) state.records.filter(record => (TYPE_STEPS[record.type] || 99) <= 6).forEach(record => ids.add(record.id));
  if (step === 8) state.records.filter(record => record.type === 'issues').forEach(record => ids.add(record.id));
  const visited = new Set();
  while ([...ids].some(id => !visited.has(id))) {
    for (const id of [...ids]) { if (visited.has(id)) continue; visited.add(id); const record = state.records.find(item => item.id === id); if (record) scan(record.data); }
  }
  const versions = state.records.filter(record => ids.has(record.id)).map(record => [record.id, record.version, record.archived]);
  return JSON.stringify([versions, state.notes[step] || '', state.stepData[step] || {}, step === 2 ? [state.focusId, state.focusAnalyses[state.focusId] || {}] : null, step === 6 ? state.meta.principlesComplete : null]);
}
export function reviewStatus(state, step) {
  const review = state.reviewed[step];
  if (review) return review.fingerprint === fingerprint(state, step) ? '已复核' : '待复核';
  const started = state.records.some(record => !record.archived && (owned[step].includes(record.type) || step === 7 && record.type === 'issues' && record.originStep === 7)) || Boolean(state.notes[step]?.trim()) || Object.values(state.stepData[step] || {}).some(Boolean) || step === 2 && Boolean(state.focusId);
  return started ? '进行中' : '未开始';
}
export function markReviewed(store, step) { store.state.reviewed[step] = { fingerprint: fingerprint(store.state, step), at: new Date().toISOString() }; store.save(); }
