import test from 'node:test';
import assert from 'node:assert/strict';
import { readSyncLogin, saveSyncLogin, clearSyncLogin } from '../src/js/core/sync-login.js';
import { freshState } from '../src/js/core/store.js';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };

test('last entered login survives a new reader, can be replaced, and can be forgotten', () => {
  const storage = memory(), first = { projectId: 'default', token: 'first-token' }, next = { projectId: 'team', token: 'second-token' };
  assert(saveSyncLogin(storage, first)); assert.deepEqual(readSyncLogin(storage), first);
  assert(saveSyncLogin(storage, next)); assert.deepEqual(readSyncLogin(storage), next);
  assert(clearSyncLogin(storage)); assert.deepEqual(readSyncLogin(storage), { projectId: 'default', token: '' });
});

test('remembered credentials are isolated by backend and excluded from project backups', () => {
  const storage = memory(), connection = { projectId: 'default', token: 'remembered-private-token' };
  saveSyncLogin(storage, connection, 'https://first.example/');
  assert.deepEqual(readSyncLogin(storage, 'https://first.example'), connection);
  assert.equal(readSyncLogin(storage, 'https://second.example').token, '');
  assert.equal(readSyncLogin(storage).token, '');
  clearSyncLogin(storage, 'https://second.example'); assert.deepEqual(readSyncLogin(storage, 'https://first.example'), connection);
  assert(!JSON.stringify(freshState()).includes(connection.token));
});

test('blocked or malformed browser storage leaves a usable empty login form', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(readSyncLogin(blocked), { projectId: 'default', token: '' });
  assert.equal(saveSyncLogin(blocked, { projectId: 'default', token: 'token' }), false); assert.equal(clearSyncLogin(blocked), false);
  for (const raw of ['{broken', '{"projectId":"../other","token":"value"}', '{"projectId":"default","token":3}']) assert.deepEqual(readSyncLogin({ getItem: () => raw }), { projectId: 'default', token: '' });
});
