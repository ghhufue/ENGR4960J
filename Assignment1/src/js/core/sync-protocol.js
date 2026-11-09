// A missing field is distinct from an explicitly empty field.
export function copy(value) { return structuredClone(value); }
export function requestId() { return [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
}
export function snapshot(object, key) { return Object.hasOwn(object, key) ? { exists: true, value: copy(object[key]) } : { exists: false }; }
export function pathKey(path) { return JSON.stringify(path); }
export function fieldMap(state) {
  const map = new Map();
  const add = (path, value) => map.set(pathKey(path), { path, value: copy(value) });
  for (const root of ['meta', 'notes', 'reviewed']) for (const [key, value] of Object.entries(state[root])) add([root, key], value);
  add(['focusId'], state.focusId);
  state.reflections.forEach((value, index) => add(['reflections', String(index)], value));
  for (const root of ['stepData', 'focusAnalyses']) for (const [id, data] of Object.entries(state[root])) for (const [key, value] of Object.entries(data)) add([root, id, key], value);
  for (const record of state.records) {
    add(['records', record.id, 'archived'], record.archived);
    for (const [key, value] of Object.entries(record.data)) add(['records', record.id, 'data', key], value);
  }
  return map;
}
export function changes(before, after) {
  const a = fieldMap(before), b = fieldMap(after), deleted = new Set(before.records.filter(record => !after.records.some(item => item.id === record.id)).map(record => record.id));
  const operations = before.records.filter(record => deleted.has(record.id)).map(record => ({ kind: 'delete', path: ['records', record.id], base: { exists: true, value: copy(record) }, next: { exists: false } }));
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const entry = b.get(key) || a.get(key);
    if (entry.path[0] === 'records' && deleted.has(entry.path[1])) continue;
    const base = a.has(key) ? { exists: true, value: a.get(key).value } : { exists: false };
    const next = b.has(key) ? { exists: true, value: b.get(key).value } : { exists: false };
    if (!equal(base, next)) operations.push({ kind: 'set', path: entry.path, base, next });
  }
  return operations;
}
export function locate(state, path, create = false) {
  if (path[0] === 'records') {
    const record = state.records.find(item => item.id === path[1]);
    if (!record) return null;
    if (path.length === 2) return { object: state.records, key: state.records.indexOf(record) };
    return path[2] === 'data' ? { object: record.data, key: path[3] } : { object: record, key: path[2] };
  }
  let object = state;
  for (const key of path.slice(0, -1)) {
    if (!Object.hasOwn(object, key)) { if (!create) return null; object[key] = {}; }
    object = object[key];
  }
  return { object, key: path.at(-1) };
}
export function readField(state, path) { const target = locate(state, path); return target ? snapshot(target.object, target.key) : { exists: false }; }
export function writeField(state, path, value) {
  const target = locate(state, path, true); if (!target) return false;
  if (path[0] === 'records' && path.length === 2 && !value.exists) state.records.splice(target.key, 1);
  else if (value.exists) target.object[target.key] = copy(value.value);
  else delete target.object[target.key];
  return true;
}
export function mergeField(current, base, next) {
  // Field lists are grow-only unions, even when a client unchecked an item.
  if (current.exists && Array.isArray(current.value) && !next.exists) return { status: 'merged', value: current };
  if (next.exists && Array.isArray(next.value)) {
    const existing = current.exists ? current.value : [];
    if (!Array.isArray(existing)) return { status: 'conflict', value: current };
    return { status: 'merged', value: { exists: true, value: [...new Set([...existing, ...next.value])] } };
  }
  if (equal(current, next)) return { status: 'unchanged', value: current };
  return equal(current, base) ? { status: 'applied', value: next } : { status: 'conflict', value: current };
}
