#!/usr/bin/env node
// extract-snippets.mjs · saca fragmentos de código REAL de site/*.js a las slides.
//
// En el código fuente se marcan así:
//     // @snippet:nombre
//     ...código...
//     // @end
//
// Genera slides/snippets.js con { nombre: {code, file, line, lang} }. Las slides
// lo consumen en tiempo de carga, así que un cambio en site/ nunca deja una
// slide desactualizada: basta con volver a ejecutar esto (o `npm run slides`).
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['site', 'simulator', 'sql'];
const EXT_LANG = { '.js': 'javascript', '.mjs': 'javascript', '.py': 'python', '.sql': 'sql', '.html': 'html', '.css': 'css' };
const START = /^\s*(?:\/\/|#|--)\s*@snippet:([\w-]+)\s*$/;
const END = /^\s*(?:\/\/|#|--)\s*@end\s*$/;

// Quita la indentación común para que el fragmento no salga sangrado en la slide.
function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join('\n').trimEnd();
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const snippets = {};
const duplicates = [];

for (const dir of SOURCES) {
  const abs = path.join(ROOT, dir);
  // El directorio puede no existir todavía (sql/ llega en la fase 6).
  try { await readdir(abs); } catch { continue; }
  for await (const file of walk(abs)) {
    const lang = EXT_LANG[path.extname(file)];
    if (!lang) continue;
    const rel = path.relative(ROOT, file);
    if (rel.includes('/buggy/') || rel.includes('/starter/')) continue; // solo la solución
    const lines = (await readFile(file, 'utf8')).split('\n');
    let name = null, buffer = [], startLine = 0;
    lines.forEach((line, i) => {
      const open = line.match(START);
      if (open) { name = open[1]; buffer = []; startLine = i + 2; return; }
      if (name && END.test(line)) {
        if (snippets[name]) duplicates.push(name);
        snippets[name] = { code: dedent(buffer), file: rel, line: startLine, lang };
        name = null;
        return;
      }
      if (name) buffer.push(line);
    });
    if (name) console.warn(`aviso: @snippet:${name} sin @end en ${rel}`);
  }
}

if (duplicates.length) console.warn(`aviso: nombres repetidos: ${duplicates.join(', ')}`);

// --- Referencias a líneas -----------------------------------------------------
// Las slides citan líneas exactas con <code data-line="…">. Se resuelven aquí,
// contra el código real, para que nunca se desfasen:
//   data-line="starter/analytics.js#trackPageView"   → línea de la función
//   data-line="site/analytics.js::value: sumValue"   → primera línea que contiene el texto
//   data-line="site/analytics.js::texto@@trackAddToCart" → primera coincidencia DESPUÉS de esa función
const html = await readFile(path.join(ROOT, 'slides', 'index.html'), 'utf8');
const refs = [...new Set([...html.matchAll(/data-line="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')))];
const lines = {};
const missing = [];
const fileCache = {};
async function linesOf(rel) {
  if (!fileCache[rel]) fileCache[rel] = (await readFile(path.join(ROOT, rel), 'utf8')).split('\n');
  return fileCache[rel];
}
function fnLine(src, name, from = 0) {
  const re = new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${name}\\b`);
  const i = src.findIndex((l, n) => n >= from && re.test(l));
  return i;
}
for (const ref of refs) {
  let n = -1;
  try {
    if (ref.includes('::')) {
      const [file, rest] = ref.split('::');
      const [needle, after] = rest.split('@@');
      const src = await linesOf(file);
      const start = after ? Math.max(0, fnLine(src, after)) : 0;
      n = src.findIndex((l, i) => i >= start && l.includes(needle));
    } else {
      const [file, fn] = ref.split('#');
      n = fnLine(await linesOf(file), fn);
    }
  } catch { n = -1; }
  if (n < 0) missing.push(ref);
  else lines[ref] = n + 1;
}
if (missing.length) {
  console.error(`ERROR: referencias de línea sin resolver:\n  ${missing.join('\n  ')}`);
  process.exitCode = 1;
}

const out = `// GENERADO por scripts/extract-snippets.mjs · no editar a mano.
// Fuente: el código real de site/ y simulator/. Regenerar con:
//   node scripts/extract-snippets.mjs
window.SNIPPETS = ${JSON.stringify(snippets, null, 2)};
window.LINES = ${JSON.stringify(lines, null, 2)};
`;
await writeFile(path.join(ROOT, 'slides', 'snippets.js'), out);
console.log(`${Object.keys(snippets).length} fragmentos y ${Object.keys(lines).length} referencias de línea → slides/snippets.js`);
for (const [k, v] of Object.entries(snippets)) {
  console.log(`  ${k.padEnd(22)} ${v.file}:${v.line}  (${v.code.split('\n').length} líneas)`);
}
