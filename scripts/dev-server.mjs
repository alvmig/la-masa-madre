#!/usr/bin/env node
// Servidor estático local sin dependencias que reproduce el árbol publicado en
// GitHub Pages:  site/ → /   ·   slides/ → /slides/   (+ starter/ → /starter/ solo en local)
// Y su comportamiento: una ruta que no es fichero devuelve 404.html con estado
// 404, igual que Pages, así el fallback SPA se prueba en local tal cual.
//
//   node scripts/dev-server.mjs            → http://localhost:8080
//   PORT=9000 node scripts/dev-server.mjs
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || process.argv[2] || 8080);

// Orden importa: el prefijo más específico primero.
const MOUNTS = [
  ['/slides/', 'slides'],
  ['/starter/', 'starter'],
  ['/', 'site'],
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function send(res, file, status) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // /slides → /slides/ (como hace Pages con los directorios)
  const dirMount = MOUNTS.find(([p]) => p.length > 1 && pathname + '/' === p);
  if (dirMount) { res.writeHead(301, { Location: dirMount[0] }); return res.end(); }

  const [prefix, dir] = MOUNTS.find(([p]) => pathname.startsWith(p));
  const base = path.join(ROOT, dir);
  let rel = pathname.slice(prefix.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }

  let status = 200;
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: pathname + '/' }); return res.end(); }
    await send(res, file, 200);
  } catch {
    status = 404;
    try { await send(res, path.join(base, '404.html'), 404); }
    catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); }
  }
  console.log(`${status} ${req.method} ${pathname}`);
}).listen(PORT, () => {
  console.log(`La Masa Madre · http://localhost:${PORT}/  ·  slides: /slides/  ·  starter: /starter/`);
});
