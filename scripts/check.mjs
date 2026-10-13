import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { bundleSingleHtml } from './build.mjs';
const root = fileURLToPath(new URL('../src/', import.meta.url));
async function walk(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat(); }
const files = (await walk(root)).filter(file => file.endsWith('.js'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/^import.+from\s+['"]([^'"]+)['"]/gm)) await readFile(resolve(dirname(file), match[1]));
}
const build = await bundleSingleHtml(); console.log(`${files.length} JavaScript modules: syntax and imports passed.\nSingle-file release verified in memory (${build.modules} modules); dist was not generated.`);
