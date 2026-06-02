# Palestras e Palestrantes — CEMANET

Repositório de apoio à alimentação de dados das **Palestras Públicas** e dos
**Palestrantes e Diretores** no site do CEMANET (WordPress + Jet Engine), via
REST API.

## Contexto

O site organiza o conteúdo em dois post types do Jet Engine que se relacionam:

- **Palestra Pública** (`palestra_publica`) — cada palestra.
- **Palestrantes e Diretores** (`palestrantes`) — pessoas; o mesmo post type
  reúne quem ministra (palestrante) e quem dirige (diretor).

Os vínculos são feitos por duas relações *many-to-many*:

| Relação | Ligação | Cardinalidade (regra de negócio) |
|--------:|---------|----------------------------------|
| **107** — Palestrante responsável | Palestra → Palestrante | 1 a 2 (obrigatório) |
| **108** — Diretor | Palestra → Diretor | 0 a 1 (opcional) |

> Essas cardinalidades são regras de negócio: o Jet Engine não as impõe, então
> precisam ser validadas na camada de alimentação.

## Estrutura

```
conteudo-palestras/        Conteúdo de cada palestra (Markdown), fonte da alimentação
estrutura-jet-engine/      Exports da estrutura do Jet Engine (referência)
  post-types/                palestra-publica.json, palestrantes-diretores.json
  taxonomias/                assuntos-principais.json
  relacionamentos/           107 (palestrante) e 108 (diretor)
snippets/                  Snippets PHP de infraestrutura (FluentSnippets)
.env.example               Modelo das variáveis de acesso à REST API
```

## Configuração

1. Copie `.env.example` para `.env` e preencha com os dados reais de acesso.
2. O `.env` e quaisquer credenciais são ignorados pelo git (ver `.gitignore`)
   e **nunca** devem ser versionados.

## Snippets

`snippets/liberar-meta-rest-palestra-publica.php` libera, pela REST API, a
escrita de campos Jet Engine protegidos (nome iniciado por `_`, como `_slides`).
Deve ser instalado no FluentSnippets.
