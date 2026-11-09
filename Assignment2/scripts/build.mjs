import { mkdir, readFile, writeFile } from 'node:fs/promises';

const read = name => readFile(new URL('../src/' + name, import.meta.url), 'utf8');
const [html, css, data, app] = await Promise.all(['index.html', 'styles.css', 'project.js', 'app.js'].map(read));
const cssTag = '<link rel="stylesheet" href="./styles.css">';
const jsTag = '<script type="module" src="./app.js"></script>';
const importLine = "import { createProject, schemas, sections, readings, normalizeProject, exportNotes } from './project.js';";
if (!html.includes(cssTag) || !html.includes(jsTag) || !app.includes(importLine)) {
  throw new Error('Could not locate the HTML and JavaScript entry points.');
}
const script = data.replace(/^export /gm, '') + '\n' + app.replace(importLine, '');
const output = html
  .replace(cssTag, () => '<style>\n' + css + '\n</style>')
  .replace(jsTag, () => '<script type="module">\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>');
const directory = new URL('../dist/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('index.html', directory), output, 'utf8');
console.log('Offline HTML: ' + new URL('index.html', directory).pathname);
