const prefix = 'engr4960j.sync.login.v1.';
const keyFor = apiBase => prefix + encodeURIComponent(apiBase.replace(/\/+$/, '') || 'same-origin');
function valid(connection) {
  return connection && typeof connection.projectId === 'string' && /^[\w-]{1,64}$/.test(connection.projectId) && typeof connection.token === 'string';
}
export function readSyncLogin(storage, apiBase = '') {
  try {
    const connection = JSON.parse(storage?.getItem(keyFor(apiBase)) || 'null');
    if (valid(connection)) return { projectId: connection.projectId, token: connection.token };
  } catch {}
  return { projectId: 'default', token: '' };
}
export function saveSyncLogin(storage, connection, apiBase = '') {
  if (!storage || !valid(connection)) return false;
  try { storage.setItem(keyFor(apiBase), JSON.stringify({ projectId: connection.projectId, token: connection.token })); return true; } catch { return false; }
}
export function clearSyncLogin(storage, apiBase = '') {
  if (!storage) return false;
  try { storage.removeItem(keyFor(apiBase)); return true; } catch { return false; }
}
