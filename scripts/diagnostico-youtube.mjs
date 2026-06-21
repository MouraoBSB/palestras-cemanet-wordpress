// Diagnóstico (somente leitura): cruza "palestra online" (palestra_online) com o
// "link do YouTube" (link_do_youtube) de todas as palestras, para achar as que estão
// com o switch LIGADO mas SEM link (mostram "Em Breve" indevidamente).
// Autoria: Thiago Mourão — https://github.com/MouraoBSB — 2026-06-21
//
// Uso: node scripts/diagnostico-youtube.mjs
// Credenciais lidas do .env (mesmo do alimentar.mjs).

import { readFile } from 'node:fs/promises';

let BASE, AUTH;

async function configurar() {
  const raw = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  BASE = (env.WP_BASE_URL || 'https://cemanet.org.br').replace(/\/$/, '') + '/wp-json';
  const pass = (env.WP_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!env.WP_USER || !pass) throw new Error('Preencha WP_USER e WP_APP_PASSWORD no .env.');
  AUTH = 'Basic ' + Buffer.from(`${env.WP_USER}:${pass}`).toString('base64');
}

async function api(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: AUTH } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

const ligado = (v) => ['true', '1', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());
const temLink = (v) => String(v ?? '').trim() !== '';
const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('pt-BR') : '—';

async function main() {
  await configurar();
  const todas = [];
  for (let page = 1; page <= 50; page++) {
    const { ok, status, json } = await api(`/wp/v2/palestra_publica?per_page=100&page=${page}&context=edit&_fields=id,slug,title,status,meta.palestra_online,meta.link_do_youtube,meta.data_da_palestra`);
    if (!ok) { if (status === 400) break; throw new Error(`HTTP ${status}`); }
    if (!Array.isArray(json) || json.length === 0) break;
    todas.push(...json);
    if (json.length < 100) break;
  }

  const agora = Date.now() / 1000;
  let onlineComLink = 0, offlineSemLink = 0;
  const onlineSemLink = [], offlineComLink = [];
  for (const p of todas) {
    const on = ligado(p.meta?.palestra_online);
    const link = temLink(p.meta?.link_do_youtube);
    const data = Number(p.meta?.data_da_palestra) || 0;
    const info = { id: p.id, slug: p.slug, status: p.status, data, passada: data ? data < agora : null,
      titulo: (p.title?.rendered || p.title?.raw || '').replace(/<[^>]+>/g, '').trim() };
    if (on && link) onlineComLink++;
    else if (on && !link) onlineSemLink.push(info);
    else if (!on && link) offlineComLink.push(info);
    else offlineSemLink++;
  }

  console.log(`Total de palestras: ${todas.length}`);
  console.log(`  online COM link (ok):           ${onlineComLink}`);
  console.log(`  online SEM link (PROBLEMA):     ${onlineSemLink.length}`);
  console.log(`  offline (switch off) COM link:  ${offlineComLink.length}`);
  console.log(`  offline sem link:               ${offlineSemLink}`);

  console.log(`\n=== PROBLEMA: "palestra online" LIGADO + SEM link do YouTube ===`);
  if (!onlineSemLink.length) console.log('(nenhuma)');
  for (const p of onlineSemLink.sort((a, b) => (b.data || 0) - (a.data || 0))) {
    const tag = p.passada === false ? '[FUTURA] ' : '[passada]';
    console.log(`${tag} ${fmt(p.data).padStart(10)}  ${String(p.status).padEnd(7)}  ${p.slug}  (id ${p.id})  — ${p.titulo}`);
  }

  if (offlineComLink.length) {
    console.log(`\n=== (extra) switch DESLIGADO mas TEM link — talvez seja só ligar o switch ===`);
    for (const p of offlineComLink.sort((a, b) => (b.data || 0) - (a.data || 0))) {
      console.log(`${fmt(p.data).padStart(10)}  ${String(p.status).padEnd(7)}  ${p.slug}  (id ${p.id})  — ${p.titulo}`);
    }
  }
}

main().catch((e) => { console.error('FALHA:', e.message); process.exitCode = 1; });
