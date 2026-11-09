import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve(process.env.SYNC_DATA_DIR || 'data'), destination = resolve(directory, 'backups');
await mkdir(destination, { recursive: true });
const database = new DatabaseSync(resolve(directory, 'workbench.sqlite'), { readOnly: true });
const filename = resolve(destination, `workbench-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
try { await backup(database, filename); console.log(`Consistent SQLite backup: ${filename}`); } finally { database.close(); }
