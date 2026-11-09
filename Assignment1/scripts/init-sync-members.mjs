import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const names = process.argv.slice(2); if (!names.length) names.push('管理员', '组员');
const directory = resolve(process.env.SYNC_DATA_DIR || 'data'); await mkdir(directory, { recursive: true });
const path = resolve(directory, 'sync-members.json');
const members = names.map((name, index) => ({ id: `member-${index + 1}`, name, admin: index === 0, token: randomBytes(32).toString('hex') }));
await writeFile(path, JSON.stringify(members, null, 2), { encoding: 'utf8', flag: 'wx' });
console.log(`Member configuration created: ${path}\nThe first member is the administrator. Existing configurations are never overwritten.\nOpen the private file locally to distribute each member's token.`);
