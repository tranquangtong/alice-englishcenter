import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(await readFile(path.join(root, 'scripts/fixtures/sample-listening.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.md': 'text/plain' };
function silenceWave(seconds = 50) {
  const size = seconds * 24000 * 2;
  const buffer = Buffer.alloc(44 + size);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + size, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(24000, 24);
  buffer.writeUInt32LE(48000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(size, 40); return buffer;
}
export async function serveFixture() {
  const server = http.createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
      let body, type = mime[path.extname(name)] || 'application/octet-stream';
      if (name === 'content/ielts-gt/listening/index.json') body = Buffer.from(JSON.stringify({ tests: [{ id: fixture.id, title: fixture.title, file: 'content/ielts-gt/listening/sample-listening.json', summary: 'Original fixture', difficulty: 'Software tests' }] }));
      else if (name === 'content/ielts-gt/listening/sample-listening.json') body = Buffer.from(JSON.stringify(fixture));
      else if (name === 'content/ielts-gt/listening/external.json') body = Buffer.from(JSON.stringify({ sites: [{ site: 'Fixture links', home: 'https://example.com', tests: [{ title: 'External fixture', url: 'https://example.com/practice' }] }] }));
      else {
        const vendor = { '__vendor/marked.js': 'node_modules/marked/marked.min.js', '__vendor/purify.js': 'node_modules/dompurify/dist/purify.min.js' };
        name = vendor[name] || name;
        const target = path.resolve(root, name);
        const relative = path.relative(root, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
        try { body = await readFile(target); }
        catch (error) {
          // Fresh checkouts need no network/TTS to exercise real browser media.
          // Locally synthesized neural fixture MP3s are preferred when present.
          if (/^scripts\/fixtures\/audio\/part[1-4]\.mp3$/.test(name)) { body = silenceWave(); type = 'audio/wav'; }
          else throw error;
        }
        if (name === 'index.html') body = Buffer.from(body.toString().replace(/<link[^>]+(?:fonts\.googleapis|fonts\.gstatic)[^>]*>/g, '').replace('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js', '__vendor/marked.js').replace('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js', '__vendor/purify.js'));
      }
      res.setHeader('Content-Type', `${type}${/text|json|javascript|svg/.test(type) ? '; charset=utf-8' : ''}`);
      res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Cache-Control', 'no-store');
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]), end = Math.min(body.length - 1, range[2] ? Number(range[2]) : body.length - 1);
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 }); res.end(body.subarray(start, end + 1));
      } else { res.writeHead(200, { 'Content-Length': body.length }); res.end(body); }
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
