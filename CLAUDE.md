# CLAUDE.md — guia para agentes

Leia antes de agir. Este arquivo orienta agentes que trabalham neste repositório.
Visão geral do domínio: ver [README.md](README.md). Aprendizados e pegadinhas: ver [MEMORY.md](MEMORY.md).

## O que é este projeto

Repositório **local** de apoio à alimentação de conteúdo das **Palestras Públicas** no
site WordPress do CEMANET (https://cemanet.org.br), via **REST API**. O site não roda
aqui; este repo guarda o conteúdo-fonte, a estrutura do Jet Engine (referência), os
snippets e o script de alimentação.

## Onde você está (estrutura)

```
conteudo-palestras/     1 arquivo .md por palestra — FONTE do conteúdo a alimentar.
                        Formatos variam (frontmatter YAML ou markdown puro); ambos válidos.
estrutura-jet-engine/   Exports JSON da estrutura (referência da verdade):
  post-types/             palestra-publica.json, palestrantes-diretores.json
  taxonomias/             assuntos-principais.json
  relacionamentos/        107 (palestrante) e 108 (diretor)
snippets/               PHP (FluentSnippets). liberar-meta-rest-...php libera escrita
                        de meta protegido (campos iniciados por _, ex.: _slides).
scripts/alimentar.mjs   Script Node que alimenta o site via REST (UPDATE + validação).
.env                    Credenciais (gitignored). Copie de .env.example.
README.md               Visão geral do domínio.
MEMORY.md               Aprendizados, decisões e pegadinhas — LEIA.
```

## O alvo no site

CPT `palestra_publica`. As palestras **já existem** no site (criadas, com data, link do
YouTube e palestrante/diretor já vinculados). A tarefa típica é **ATUALIZAR conteúdo**,
não criar.

- **Alimentamos** (do .md): `excerpt` (subtítulo), `content` (descrição),
  `meta.assuntos_principais` (repeater), taxonomia `assuntos-principais`,
  `meta.escolher_cor_do_fundo`, `meta.publico_online` (e presencial/total quando
  informados), `meta._slides` (precisa do snippet).
- **PRESERVAR sempre** (não enviar): `title`, `meta.data_da_palestra`,
  `meta.link_do_youtube`, e os vínculos das relações **107** (palestrante) e **108** (diretor).

## Como alimentar

1. Configure o `.env` (copie de `.env.example`).
2. Teste a autenticação: `node scripts/alimentar.mjs --check` (espera HTTP 200).
3. Prepare um JSON de dados (um objeto por palestra — formato no cabeçalho do script).
4. Rode: `node scripts/alimentar.mjs <dados.json>`. O script resolve as taxonomias por
   nome/slug, faz o UPDATE preservando o que deve, relê e valida cada palestra.

## Autenticação (PEGADINHA)

Basic Auth com Application Password. O `WP_USER` é o **E-MAIL** do usuário de serviço
(`...@cemanet.org.br`) — o login curto retorna **401**. Veja `WP_USER`/`WP_APP_PASSWORD`
no `.env`. **Nunca** versione credenciais (o `.gitignore` já bloqueia `.env`, `*.secret` etc.).

## Regras de negócio / decisões do cliente

- **Cardinalidade:** 1–2 palestrantes (rel 107, obrigatório), 0–1 diretor (rel 108). Já
  vinculados no site — não mexer.
- **Datas:** toda palestra é num **domingo**, 1 por domingo. `data_da_palestra` (meta,
  timestamp Unix) já está no site — preservar. A data no topo de alguns `.md`
  (ex.: `16/06/2026`) é a **data de geração do arquivo** — IGNORAR.
- **Precedência:** o documento prevalece sobre o site em conflito; o que o documento não
  trata (data, YouTube, vínculos), preserva-se.
- **Público:** gravar `publico_online` do documento; preservar presencial/total do site
  (exceto quando o documento informa os três explicitamente).
- **Taxonomia:** `assuntos-principais` é hierárquica (~140 termos). A coluna "Grupo" dos
  `.md` **não** corresponde aos parents reais — mapear só os termos-folha (por nome/slug).
  Avisar termos inexistentes em vez de criar sem combinar.
- **Conteúdo extra:** "Referências doutrinárias" → anexar ao fim da descrição. Preparador(a)
  do encontro → citar na descrição (o site não tem campo próprio).

## Estado atual (jun/2026)

As **27 palestras** de `conteudo-palestras/` foram alimentadas no site. Detalhes e
histórico em [MEMORY.md](MEMORY.md).

## Idioma

Todo conteúdo (código, comentários, documentação, commits) em **português brasileiro**.
