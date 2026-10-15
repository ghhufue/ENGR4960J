import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ProjectService } from './project-service.mjs';
import { ApiError, requireThat } from './validation.mjs';
const root = resolve(fileURLToPath(new URL('../src/', import.meta.url)));
const digest = token => createHash('sha256').update(token).digest();
export async function createSyncServer({ database = ':memory:', members = [], allowLocal = false, allowedOrigins = [] } = {}) {
  const origins = new Set(allowedOrigins.map(origin => { const url = new URL(origin); requireThat(['http:', 'https:'].includes(url.protocol) && url.origin === origin, '允许的来源必须是完整的 HTTP 或 HTTPS 来源地址。'); return origin; }));
  const service = new ProjectService(database);
  const identities = members.map(member => { requireThat(typeof member.token === 'string' && member.token.length >= 24 && typeof member.id === 'string' && typeof member.name === 'string', '成员配置需要 id、name 和至少 24 字符的 token。'); return { id: member.id, name: member.name, admin: member.admin === true, hash: digest(member.token) }; });
  const server = createServer(async (request, response) => {
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(value === undefined ? '' : JSON.stringify(value)); };
    try {
      const url = new URL(request.url, 'http://localhost'), pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/')) {
        response.setHeader('Vary', 'Origin');
        const origin = request.headers.origin;
        if (origin) {
          let sameHost = false;
          try { const parsed = new URL(origin); sameHost = ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin && parsed.host === request.headers.host; } catch {}
          requireThat(sameHost || origins.has(origin), '请求来源未获允许。', 403);
          response.setHeader('Access-Control-Allow-Origin', origin);
        }
        if (request.method === 'OPTIONS') {
          requireThat(origin && ['GET', 'POST'].includes(request.headers['access-control-request-method']), '无效的跨域预检请求。', 403);
          const headers = (request.headers['access-control-request-headers'] || '').split(',').map(header => header.trim().toLowerCase()).filter(Boolean);
          requireThat(headers.every(header => ['authorization', 'content-type'].includes(header)), '请求头未获允许。', 403);
          response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }); response.end(); return;
        }
        if (pathname === '/api/health') { requireThat(request.method === 'GET', '不支持该请求方法。', 405); json(200, { ok: true }); return; }
        const token = (request.headers.authorization || '').replace(/^Bearer /, '');
        const found = identities.find(member => timingSafeEqual(member.hash, digest(token)));
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
        const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${request.headers.host}`).hostname);
        const actor = found || (allowLocal && identities.length === 0 && loopback && localHost ? { id: 'local', name: '本机开发', admin: true } : null);
        requireThat(actor, '访问令牌无效，请连接项目。', 401);
        const match = pathname.match(/^\/api\/projects\/([\w-]{1,64})(?:\/(.*))?$/); requireThat(match, '接口不存在。', 404);
        const [, id, resource = ''] = match;
        let body;
        if (request.method === 'POST') {
          requireThat((request.headers['content-type'] || '').startsWith('application/json'), '需要 application/json。', 415);
          let size = 0; const parts = [];
          for await (const part of request) { size += part.length; requireThat(size <= 6 * 1024 * 1024, '请求超过 6 MB。', 413); parts.push(part); }
          try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new ApiError(400, 'JSON 请求格式无效。'); }
          requireThat(body && typeof body === 'object' && !Array.isArray(body), '请求必须是对象。', 400);
        }
        if (request.method === 'GET' && !resource) {
          const project = service.get(id);
          // Always include pending conflicts; revision changes also cover conflicts.
          if (url.searchParams.get('ifRevision') === String(project.revision)) json(204);
          else json(200, { ...project, conflicts: service.conflicts(id), actor: { id: actor.id, name: actor.name, admin: actor.admin } });
        } else if (request.method === 'POST' && resource === 'changes') json(200, service.submit(id, actor, body));
        else if (request.method === 'POST' && resource === 'records') json(200, service.createRecord(id, actor, body));
        else if (request.method === 'GET' && resource === 'conflicts') json(200, service.conflicts(id));
        else if (request.method === 'POST' && /^conflicts\/[\w-]+\/resolve$/.test(resource)) json(200, service.resolve(id, resource.split('/')[1], actor, body));
        else if (request.method === 'GET' && resource === 'history') {
          const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER), limit = Number(url.searchParams.get('limit') || 30);
          requireThat(Number.isSafeInteger(before) && before > 0 && Number.isInteger(limit) && limit > 0 && limit <= 100, '历史分页参数无效。', 400); json(200, service.listHistory(id, before, limit));
        } else if (request.method === 'GET' && /^revisions\/\d+$/.test(resource)) json(200, service.getRevision(id, Number(resource.split('/')[1])));
        else if (request.method === 'POST' && resource === 'replace') json(200, service.replace(id, actor, body));
        else throw new ApiError(404, '接口不存在。');
        return;
      }
      requireThat(request.method === 'GET' || request.method === 'HEAD', '不支持该请求方法。', 405);
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      requireThat(path.startsWith(root + sep), 'Forbidden', 403);
      let content; try { content = await readFile(path); } catch { throw new ApiError(404, '文件不存在。'); }
      const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.svg': 'image/svg+xml' };
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) { json(error.status || 500, { error: error.status ? error.message : '后端处理失败，当前提交未确认。' }); }
  });
  return { server, service, close: async () => { await new Promise(resolveClose => server.close(resolveClose)); service.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 5173);
  const directory = resolve(process.env.SYNC_DATA_DIR || 'data'); await mkdir(directory, { recursive: true });
  const members = process.env.SYNC_MEMBERS_FILE ? JSON.parse(await readFile(process.env.SYNC_MEMBERS_FILE, 'utf8')) : [];
  requireThat(['127.0.0.1', '::1', 'localhost'].includes(host) || members.length > 0, '对局域网开放前，请设置 SYNC_MEMBERS_FILE。');
  const allowedOrigins = (process.env.SYNC_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
  const app = await createSyncServer({ database: resolve(directory, 'workbench.sqlite'), members, allowLocal: members.length === 0, allowedOrigins });
  app.server.listen(port, host, () => console.log(`Workbench: http://${host}:${port}\nDatabase: ${resolve(directory, 'workbench.sqlite')}\nLocal development login: ${members.length === 0 ? 'enabled (loopback only)' : 'disabled'}`));
  process.on('SIGINT', async () => { await app.close(); process.exit(0); });
}
