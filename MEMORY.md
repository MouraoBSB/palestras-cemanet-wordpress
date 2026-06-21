# MEMORY.md — aprendizados e decisões

Registro técnico para evitar repetir descobertas custosas. Complementa o [CLAUDE.md](CLAUDE.md).

## Autenticação REST

- O `WP_USER` do Basic Auth é o **E-MAIL** do usuário de serviço (`...@cemanet.org.br`).
  O login curto (`agenda-reforma`) retorna **401 rest_not_logged_in**. (Usuário id 179,
  "Agenda Reforma - Claude".)
- Application Password: os espaços do código são **ignorados** pelo WP; o script os remove.
- Credenciais ficam **só** no `.env` (gitignored). O antigo arquivo em texto plano
  `Credenciais de Acesso/Aplicativo.txt` foi removido (era um risco).
- **GET** (leitura) é público; **escrita** (POST) exige autenticação.

## Campos / REST do Jet Engine

- `meta.data_da_palestra`: timestamp Unix. `meta.link_do_youtube`: string. Ambos já
  preenchidos no site — preservar.
- `meta.publico_online` / `publico_presencial` / `publico_total`: registrados como
  **STRING** no REST. Enviar `"35"`, não `35` (número dá `rest_invalid_type` 400).
- `meta.escolher_cor_do_fundo`: hex, ex.: `#89ab98`.
- `meta.assuntos_principais`: repeater como **OBJETO** `{ "item-0": {destaque, texto}, ... }`.
- Taxonomia: array de IDs no campo de **topo** `assuntos-principais` (não em `meta`).
  Hierárquica. Os "Grupos" dos `.md` **não** são os parents reais. "Obras Psicografadas"
  não existe no site → foi mapeado para **"Literatura Espírita"** (id 109).
- Meta protegido (`_slides` e iniciados por `_`): bloqueado no REST; liberado pelo snippet
  `snippets/liberar-meta-rest-palestra-publica.php` (FluentSnippets).

## Decisões do cliente (alimentação, jun/2026)

- **ATUALIZAR** registros existentes (não criar).
- Preservar **título, data, YouTube e vínculos** 107/108.
- **Documento prevalece** em conflito; o que o doc não trata, mantém do site.
- Público: gravar só o **online** do doc; preservar presencial/total do site (salvo quando
  o doc informa os três — ex.: A Bailarina 249/67, Conectando Almas 111/45,
  Espiritualidade 230/62).
- "Referências doutrinárias" → anexar ao fim da descrição. Preparador(a) (ex.: Emanuela em
  *Estudo que Liberta*) → citar na descrição.
- Datas `16/06/2026` no topo dos `.md` = data de geração; usar a data do site (domingos).

## Execução realizada (2026-06-21)

- **27/27** palestras de `conteudo-palestras/` alimentadas via `scripts/alimentar.mjs`
  (1 piloto + lote de 26).
- Fluxo: curadoria (extração **verbatim** de cada `.md`) → JSON de dados →
  `scripts/alimentar.mjs` (resolve taxonomia, faz UPDATE, relê e valida).
- Correções aplicadas nos `.md`: URL da *Conexão com a Vida* (apontava para a página do
  palestrante → `/palestra_publica/conexao-com-a-vida/`); `1981` → `1961` em *Expandindo
  Horizontes* (fundação do CEMA = **1961**); URLs registradas em *Transformando a
  Comunidade* e *Espiritualidade e Solidariedade*.

## Ambiente

- **Node 24** disponível (`fetch` nativo). **Sem** Python, **sem** jq. `curl` disponível.
- Não use `process.exit()` abrupto após `fetch` no Windows — causa
  `Assertion failed (uv async)`. Prefira `process.exitCode` e deixar o processo encerrar.
- Slugs que **diferem** do nome do arquivo: `expandindo-horizontes` →
  `cema-expandindo-horizontes`; `conectando-almas` → `cema-conectando-almas`;
  `transformando-a-comunidade` → `cema-transformando-a-comunidade`; espiritualidade-64 →
  `espiritualidade-e-solidariedade-celebrando-64-anos-de-cema`; conexao-raiane →
  `conexao-com-a-vida`; perguntas-setembro → `perguntas-e-respostas`.
