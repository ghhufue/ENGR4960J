import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { bundleSingleHtml } from './build.mjs';
const root = fileURLToPath(new URL('../src/', import.meta.url));
async function walk(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat(); }
const serverRoot = fileURLToPath(new URL('../server/', import.meta.url));
const files = [...await walk(root), ...await walk(serverRoot)].filter(file => /\.(?:js|mjs)$/.test(file));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/^import.+from\s+['"]([^'"]+)['"]/gm)) {
    if (match[1].startsWith('.')) await readFile(resolve(dirname(file), match[1]));
    else if (!match[1].startsWith('node:')) throw new Error(`Unsupported import: ${match[1]}`);
  }
}
const build = await bundleSingleHtml(); console.log(`${files.length} JavaScript modules: syntax and imports passed.\nSingle-file release verified in memory (${build.modules} modules); dist was not generated.`);
