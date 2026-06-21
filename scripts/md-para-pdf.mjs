// Converte um arquivo Markdown em PDF usando o Microsoft Edge (ou Chrome) headless.
// Não requer dependências externas — usa o navegador já instalado no Windows.
// Autoria: Thiago Mourão — https://github.com/MouraoBSB — 2026-06-21
//
// Uso: node scripts/md-para-pdf.mjs <arquivo.md>   -> gera <arquivo.pdf> ao lado.

import { readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => /^https?:\/\//i.test(url) ? `<a href="${url}">${txt}</a>` : txt);
  return t;
}
function renderTable(rows) {
  const parse = (r) => r.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  const header = parse(rows[0]);
  const body = rows.slice(2); // pula a linha separadora |---|
  const thead = '<thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + body.map((r) => '<tr>' + parse(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>';
  return `<table>${thead}${tbody}</table>`;
}
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) {
      const n = line.match(/^#+/)[0].length;
      out.push(`<h${n}>${inline(line.replace(/^#+\s+/, ''))}</h${n}>`); i++; continue;
    }
    if (/^\|/.test(line)) {
      const tbl = [];
      while (i < lines.length && /^\|/.test(lines[i])) { tbl.push(lines[i]); i++; }
      out.push(renderTable(tbl)); continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s+/, '')); i++; }
      out.push('<ul>' + items.map((it) => `<li>${inline(it)}</li>`).join('') + '</ul>'); continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(`<p>${inline(line)}</p>`); i++;
  }
  return out.join('\n');
}

const CSS = `
@page { size: A4; margin: 1.4cm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.45; }
h1 { font-size: 18px; color: #4e4483; border-bottom: 2px solid #4e4483; padding-bottom: 6px; margin: 0 0 8px; }
p { margin: 4px 0; }
ul { margin: 6px 0; padding-left: 18px; }
li { margin: 2px 0; }
code { background: #f2f2f4; padding: 1px 4px; border-radius: 3px; font-family: Consolas, monospace; font-size: 10px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
thead { display: table-header-group; }
th { background: #4e4483; color: #fff; text-align: left; padding: 5px 7px; font-size: 10px; }
td { border-bottom: 1px solid #e0e0e0; padding: 4px 7px; vertical-align: top; }
tbody tr:nth-child(even) { background: #f7f6fa; }
tr { break-inside: avoid; }
a { color: #2a7a3a; text-decoration: none; word-break: break-all; }
strong { color: #000; }
`;

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

async function main() {
  const mdPath = path.resolve(process.argv[2] || '');
  if (!process.argv[2] || !existsSync(mdPath)) throw new Error(`Arquivo .md não encontrado: ${process.argv[2]}`);

  const dir = path.dirname(mdPath);
  const baseName = path.basename(mdPath, '.md');
  const htmlPath = path.join(dir, baseName + '.tmp.html');
  const pdfPath = path.join(dir, baseName + '.pdf');

  const md = await readFile(mdPath, 'utf8');
  const fullHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(baseName)}</title><style>${CSS}</style></head><body>${mdToHtml(md)}</body></html>`;
  await writeFile(htmlPath, fullHtml, 'utf8');

  const browser = BROWSERS.find(existsSync);
  if (!browser) throw new Error('Edge/Chrome não encontrado nos caminhos padrão.');

  const userData = path.join(tmpdir(), 'edge-pdf-' + process.pid);
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/').replace(/ /g, '%20');
  const baseArgs = ['--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${userData}`, `--print-to-pdf=${pdfPath}`, fileUrl];

  try {
    execFileSync(browser, ['--headless=new', ...baseArgs], { stdio: 'pipe', timeout: 90000 });
  } catch {
    execFileSync(browser, ['--headless', ...baseArgs], { stdio: 'pipe', timeout: 90000 });
  }

  if (!existsSync(pdfPath)) throw new Error('O PDF não foi gerado (navegador não produziu o arquivo).');
  const s = await stat(pdfPath);
  await unlink(htmlPath).catch(() => {});
  console.log(`PDF gerado: ${path.basename(pdfPath)} (${Math.round(s.size / 1024)} KB)`);
  console.log(`Navegador usado: ${browser}`);
}

main().catch((e) => { console.error('FALHA:', e.message); process.exitCode = 1; });
