import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('../src/', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(resolve(root) + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    const body = await readFile(path); response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}\nDevelopment source: ${root}\nPress Ctrl+C to stop.`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
