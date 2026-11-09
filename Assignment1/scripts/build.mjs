import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative, sep } from 'node:path';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../src/', import.meta.url));
export async function bundleSingleHtml() {
  const modules = new Map(); const code = []; const pending = new Set();
  async function compile(file) {
    file = resolve(file);
    if (!file.startsWith(resolve(root) + sep)) throw new Error('Build imports must stay in src.');
    if (modules.has(file)) return modules.get(file);
    if (pending.has(file)) throw new Error(`Circular import: ${file}`);
    pending.add(file);
    let source = await readFile(file, 'utf8'); const imports = [];
    const pattern = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
    for (const match of source.matchAll(pattern)) {
      if (!match[2].startsWith('.')) throw new Error('Only local named imports are supported.');
      const dependency = await compile(resolve(dirname(file), match[2]));
      const names = match[1].split(',').map(name => name.trim().replace(/\s+as\s+/, ': ')).join(', ');
      imports.push(`const { ${names} } = ${dependency};`);
    }
    source = source.replace(pattern, '');
    const exports = [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm)].map(match => match[1]);
    source = source.replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|class)\s)/gm, '');
    if (/^import\s|^export\s/m.test(source)) throw new Error(`Unsupported module syntax: ${file}`);
    const name = `module${modules.size}`; modules.set(file, name); pending.delete(file);
    code.push(`// ${relative(root, file).split(sep).join('/')}\nconst ${name} = (() => {\n${imports.join('\n')}\n${source}\nreturn { ${exports.join(', ')} };\n})();`);
    return name;
  }
  await compile(resolve(root, 'js/app.js'));
  const javascript = `(() => {\n'use strict';\n${code.join('\n\n')}\n})();`;
  new vm.Script(javascript, { filename: 'release-bundle.js' });
  let html = await readFile(resolve(root, 'index.html'), 'utf8');
  for (const match of [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]) {
    const css = await readFile(resolve(root, match[1]), 'utf8'); html = html.replace(match[0], `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
  }
  html = html.replace(/<script type="module" src="\.\/js\/app.js"><\/script>/, `<script>\n${javascript.replace(/<\/script/gi, '<\\/script')}\n</script>`);
  html = html.replace('请运行 npm run dev，以本地服务器打开开发版本。', '请检查浏览器是否允许 JavaScript。');
  if (/<(?:link|script)[^>]+(?:href|src)="\.\//.test(html)) throw new Error('Release HTML still has external source dependencies.');
  return { html, modules: modules.size };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { html, modules } = await bundleSingleHtml();
  if (process.argv.includes('--check')) console.log(`Release bundle verified in memory: ${modules} modules, ${Buffer.byteLength(html)} bytes. No release file written.`);
  else {
    const destination = fileURLToPath(new URL('../dist/index.html', import.meta.url)); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, html, 'utf8'); console.log(`Single-file release: ${destination}\n${modules} modules bundled; no online dependency.`);
  }
}
