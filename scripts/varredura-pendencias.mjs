// Varredura (somente leitura): lista palestras JÁ REALIZADAS com pendência de
// preenchimento — campo vazio entre descrição, taxonomia (assuntos-principais) e
// assuntos principais abordados (repeater meta.assuntos_principais).
// Gera um documento Markdown no mesmo formato de palestras-passadas-pendentes.md.
// Autoria: Thiago Mourão — https://github.com/MouraoBSB — 2026-06-21
//
// Uso: node scripts/varredura-pendencias.mjs
// Credenciais lidas do .env.

import { readFile, writeFile } from 'node:fs/promises';

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

// Verdadeiro se a descrição (content) não tem texto visível.
function descricaoVazia(content) {
  const html = content?.raw ?? content?.rendered ?? '';
  const txt = String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  return txt.length === 0;
}
// Verdadeiro se o repeater de assuntos está vazio (sem nenhum item com conteúdo).
function assuntosVazios(meta) {
  const a = meta?.assuntos_principais;
  if (!a || typeof a !== 'object') return true;
  const itens = Object.values(a);
  if (!itens.length) return true;
  return !itens.some((it) => String(it?.destaque || '').trim() || String(it?.texto || '').trim());
}

const fmtData = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('pt-BR') : 'sem data';
const tit = (t) => String(t?.raw || t?.rendered || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

async function main() {
  await configurar();
  const todas = [];
  for (let page = 1; page <= 50; page++) {
    const { ok, status, json } = await api(`/wp/v2/palestra_publica?per_page=100&page=${page}&context=edit&status=publish&_fields=id,slug,title,content,assuntos-principais,meta.assuntos_principais,meta.link_do_youtube,meta.data_da_palestra`);
    if (!ok) { if (status === 400) break; throw new Error(`HTTP ${status}`); }
    if (!Array.isArray(json) || json.length === 0) break;
    todas.push(...json);
    if (json.length < 100) break;
  }

  const agora = Date.now() / 1000;
  const pendentes = [];
  for (const p of todas) {
    const data = Number(p.meta?.data_da_palestra) || 0;
    if (data && data > agora) continue; // exclui futuras
    const pend = [];
    if (descricaoVazia(p.content)) pend.push('descrição');
    if ((p['assuntos-principais'] || []).length === 0) pend.push('taxonomia');
    if (assuntosVazios(p.meta)) pend.push('assuntos');
    if (!pend.length) continue;
    pendentes.push({
      data, titulo: tit(p.title), pend, slug: p.slug,
      youtube: String(p.meta?.link_do_youtube || '').trim(),
    });
  }

  // Ordena por data desc; sem data por último.
  pendentes.sort((a, b) => (b.data || 0) - (a.data || 0));

  const semNada = pendentes.filter((p) => p.pend.length === 3).length;
  const soDescricao = pendentes.filter((p) => p.pend.length === 1 && p.pend[0] === 'descrição').length;
  const outras = pendentes.length - semNada - soDescricao;
  const comYoutube = pendentes.filter((p) => p.youtube).length;

  const hoje = new Date().toLocaleDateString('pt-BR');
  const linhas = pendentes.map((p) =>
    `| ${fmtData(p.data)} | ${p.titulo} | ${p.pend.join(', ')} | ${p.youtube ? `[vídeo](${p.youtube})` : '—'} |`);

  const md = `# Palestras passadas com pendências de preenchimento

Gerado em ${hoje} — fonte: REST API de cemanet.org.br (post type \`palestra_publica\`).
Critério: palestras **já realizadas** (futuras excluídas) com ao menos um campo vazio entre **descrição**, **taxonomia** e **assuntos principais abordados**.

- Total de palestras pendentes: **${pendentes.length}**
- Sem nada preenchido (descrição + taxonomia + assuntos): **${semNada}**
- Faltando somente a descrição (taxonomia e assuntos ok): **${soDescricao}**
- Outras combinações parciais: **${outras}**
- Com link do YouTube já cadastrado no site: **${comYoutube}** de ${pendentes.length}

| Data | Título | Pendências | YouTube |
|------|--------|------------|---------|
${linhas.join('\n')}
`;

  const dt = new Date();
  const nomeData = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const nomeArquivo = `palestras-passadas-pendentes-${nomeData}.md`;
  await writeFile(new URL(`../${nomeArquivo}`, import.meta.url), md, 'utf8');

  console.log(`Documento gerado: ${nomeArquivo}`);
  console.log(`Total de palestras analisadas (publicadas): ${todas.length}`);
  console.log(`Pendentes: ${pendentes.length} | sem nada: ${semNada} | só descrição: ${soDescricao} | outras: ${outras} | com YouTube: ${comYoutube}`);
  console.log(`\n[verificação] As 27 alimentadas NÃO devem aparecer como pendentes de descrição/taxonomia/assuntos:`);
  const alimentadas = new Set(['voz-da-consciencia', 'a-bailarina', 'conexao-com-a-vida', 'cema-conectando-almas', 'estudo-que-liberta', 'bem-aventurados-os-aflitos', 'comunhao-com-deus', 'quando-o-espirito-floresce', 'ressignificar-a-partida', 'o-leito-que-virou-tribuna', 'jesus-e-eu', 'a-dor-que-cura', 'perguntas-e-respostas', 'bezerra-amor-em-acao', 'ser-pai-estar-pai', 'a-essencia-do-saber', 'reflexoes-evangelicas', 'reflexoes-com-andre-luiz', 'espiritismo-e-atualidade', 'evangelho-de-tiago', 'cema-expandindo-horizontes', 'espiritualidade-e-solidariedade-celebrando-64-anos-de-cema', 'cema-transformando-a-comunidade', 'transicao-planetaria', 'o-papel-do-espiritismo-na-transformacao-do-mundo', 'maternidade-um-legado-de-amor', 'evangelizacao-transformando-vidas']);
  const reincidentes = pendentes.filter((p) => alimentadas.has(p.slug));
  if (reincidentes.length === 0) console.log('  OK — nenhuma das 27 aparece pendente.');
  else for (const r of reincidentes) console.log(`  !! ${r.slug}: ${r.pend.join(', ')}`);
}

main().catch((e) => { console.error('FALHA:', e.message); process.exitCode = 1; });
