// Alimentação em lote de palestras (palestra_publica) no WordPress CEMANET via REST API.
// Atualiza o CONTEÚDO de registros existentes, preservando título, data, YouTube e vínculos.
// Autoria: Thiago Mourão — https://github.com/MouraoBSB — 2026-06-21
//
// Uso:
//   node scripts/alimentar.mjs --check                 -> testa só a autenticação
//   node scripts/alimentar.mjs <arquivo-dados.json>    -> alimenta as palestras do arquivo
//     <arquivo-dados.json> pode ser um array, {dados:[...]} ou a saída do workflow
//     de curadoria ({result:{dados:[...]}}).
//
// Cada item de dados: { id, slug, excerpt, paragrafos[], assuntos[{destaque,texto}],
//   taxonomia_nomes[], cor_fundo, publico_online, publico_presencial?, publico_total? }
//
// Credenciais: lidas do ".env" na raiz do projeto (NÃO versionado).
//   WP_BASE_URL, WP_USER (o E-MAIL do usuário de serviço), WP_APP_PASSWORD.

import { readFile } from 'node:fs/promises';

let BASE, WP_USER, AUTH;

// ---- Helpers ----
const html = (s) => String(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function lerEnv() {
  const raw = await readFile(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

async function configurar() {
  const env = await lerEnv();
  BASE = (env.WP_BASE_URL || 'https://cemanet.org.br').replace(/\/$/, '') + '/wp-json';
  WP_USER = env.WP_USER;
  const pass = (env.WP_APP_PASSWORD || '').replace(/\s+/g, ''); // WP ignora os espaços
  if (!WP_USER || !pass) throw new Error('Preencha WP_USER e WP_APP_PASSWORD no arquivo .env.');
  AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${pass}`).toString('base64');
}

async function api(method, path, body) {
  const headers = { Authorization: AUTH };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

async function carregarTaxonomia() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { ok, status, json } = await api('GET', `/wp/v2/assuntos-principais?per_page=100&page=${page}&_fields=id,name,slug`);
    if (!ok) { if (status === 400) break; throw new Error(`Falha ao carregar taxonomia (HTTP ${status})`); }
    if (!Array.isArray(json) || json.length === 0) break;
    all.push(...json);
    if (json.length < 100) break;
  }
  const byNorm = new Map(), bySlug = new Map();
  for (const t of all) { byNorm.set(norm(t.name), t.id); bySlug.set(t.slug, t.id); }
  return { total: all.length, byNorm, bySlug };
}

function resolverNomes(nomes, tax) {
  const ids = [], faltam = [];
  for (const n of nomes || []) {
    let id = tax.byNorm.get(norm(n));
    if (id == null) id = tax.bySlug.get(slugify(n));
    if (id == null) faltam.push(n); else if (!ids.includes(id)) ids.push(id);
  }
  return { ids, faltam };
}

function montarPayload(p, termIds) {
  const content = (p.paragrafos || []).map((x) => `<p>${html(x)}</p>`).join('\n');
  const assuntos = {};
  (p.assuntos || []).forEach((a, i) => { assuntos[`item-${i}`] = { destaque: html(a.destaque), texto: html(a.texto) }; });
  const meta = { assuntos_principais: assuntos, escolher_cor_do_fundo: p.cor_fundo || '' };
  const set = (k, v) => { if (v != null && String(v).trim() !== '') meta[k] = String(v).trim(); };
  set('publico_online', p.publico_online);
  set('publico_presencial', p.publico_presencial);
  set('publico_total', p.publico_total);
  // Título, data, YouTube e vínculos NÃO são enviados -> preservados.
  return { excerpt: p.excerpt || '', content, 'assuntos-principais': termIds, meta };
}

async function alimentar(p, tax) {
  const { ids, faltam } = resolverNomes(p.taxonomia_nomes, tax);
  const up = await api('POST', `/wp/v2/palestra_publica/${p.id}`, montarPayload(p, ids));
  if (!up.ok) return { slug: p.slug, ok: false, err: `HTTP ${up.status} ${JSON.stringify(up.json).slice(0, 160)}`, faltam };

  const fields = 'id,slug,excerpt,meta.assuntos_principais,meta.escolher_cor_do_fundo,meta.publico_online,meta.data_da_palestra,meta.link_do_youtube,assuntos-principais';
  const { json: v } = await api('GET', `/wp/v2/palestra_publica/${p.id}?context=edit&_fields=${fields}`);
  const nAss = v?.meta?.assuntos_principais && typeof v.meta.assuntos_principais === 'object' ? Object.keys(v.meta.assuntos_principais).length : 0;
  return {
    slug: p.slug, ok: true, nAss, nTaxSite: (v?.['assuntos-principais'] || []).length,
    cor: v?.meta?.escolher_cor_do_fundo || '', online: v?.meta?.publico_online || '',
    preserv: !!v?.meta?.data_da_palestra, faltam,
  };
}

async function main() {
  await configurar();
  const arg = process.argv[2];

  if (arg === '--check') {
    const me = await api('GET', '/wp/v2/users/me?_fields=id,slug,name');
    console.log(`Auth check (HTTP ${me.status}):`, JSON.stringify(me.json));
    process.exitCode = me.ok ? 0 : 1;
    return;
  }
  if (!arg) { console.error('Uso: node scripts/alimentar.mjs <arquivo-dados.json> | --check'); process.exitCode = 1; return; }

  const raw = JSON.parse(await readFile(arg, 'utf8'));
  const lista = Array.isArray(raw) ? raw : (raw.dados || raw.result?.dados);
  if (!Array.isArray(lista)) { console.error('Não encontrei o array de dados no arquivo.'); process.exitCode = 1; return; }

  const tax = await carregarTaxonomia();
  console.log(`Autenticado como ${WP_USER}. Taxonomia: ${tax.total} termos. Palestras: ${lista.length}.\n`);

  const rel = [];
  for (const p of lista) {
    try { rel.push(await alimentar(p, tax)); }
    catch (e) { rel.push({ slug: p.slug, ok: false, err: e.message }); }
  }

  let ok = 0;
  for (const r of rel) {
    if (r.ok) {
      ok++;
      const al = r.faltam?.length ? ` | FALTAM termos: ${r.faltam.join(', ')}` : '';
      console.log(`OK   ${r.slug.padEnd(48)} ${r.nAss} assuntos · ${r.nTaxSite} tax · cor ${r.cor || '-'} · online ${r.online || '-'} · ${r.preserv ? 'data preservada' : 'ATENCAO data'}${al}`);
    } else {
      console.log(`ERRO ${r.slug.padEnd(48)} ${r.err}`);
    }
  }
  console.log(`\nResumo: ${ok}/${rel.length} ok.`);
  const faltantes = [...new Set(rel.flatMap((r) => r.faltam || []))];
  if (faltantes.length) console.log(`\nTermos de taxonomia que NAO existem no site (avaliar criacao/mapeamento): ${faltantes.join(' | ')}`);
}

main().catch((e) => { console.error('FALHA:', e.message); process.exitCode = 1; });
