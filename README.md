# Sistema Cooesa

Sistema interno de propostas, contratos, clientes e faturamento da Cooesa Engenharia S/S Ltda.,
substituindo a planilha `Acompanhamento_de_Contratos.xls` usada desde 2000. A especificação
completa está em [`docs/PROMPT.md`](docs/PROMPT.md).

- **Next.js 16** (App Router) + TypeScript `strict`
- **Supabase**: PostgreSQL, Auth e Row Level Security (projeto em São Paulo, plano gratuito)
- **Vercel** para hospedagem; backup semanal por **GitHub Actions**

Regra de ouro: nenhum dado histórico é perdido, inventado ou corrigido em silêncio. Os textos
originais da planilha ficam em colunas próprias (`data_ini_texto`, `valor_texto`,
`empresa_original`…), toda alteração vai para `historico_alteracoes` e as inconsistências
aparecem em **Pendências de dados**.

---

## Sumário

1. [Rodar localmente](#1-rodar-localmente)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Supabase: projeto, migrações e autenticação](#3-supabase-projeto-migrações-e-autenticação)
4. [Carga da planilha e conferência](#4-carga-da-planilha-e-conferência)
5. [Deploy na Vercel](#5-deploy-na-vercel)
6. [Backup e restauração](#6-backup-e-restauração)
7. [Papéis e segurança](#7-papéis-e-segurança)
8. [Testes](#8-testes)
9. [Estrutura do código](#9-estrutura-do-código)
10. [Pendências em aberto com o dono](#10-pendências-em-aberto-com-o-dono)

---

## 1. Rodar localmente

Requisitos: Node.js 20.9+ e o [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
cp .env.example .env.local        # preencha com as chaves do projeto (seção 2)
npm run dev                       # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm run typecheck` · `npm run lint` | TypeScript e ESLint |
| `npm test` | testes (banco em memória com PGlite, sem Docker) |
| `npm run e2e` | testes de ponta a ponta no navegador, só leitura (ver seção 8) |
| `npm run format` / `format:check` | formata / confere a formatação (Prettier) |
| `npm run tipos` | gera `src/lib/database.types.ts` a partir do banco (precisa de `supabase link`) |
| `npm run seed` | carga da planilha no Supabase + conferência |
| `npm run conferir` | só a conferência, sem gravar nada |
| `npm run criar-admin -- email "Nome"` | cria (ou promove) um administrador |

## 2. Variáveis de ambiente

Documentadas em [`.env.example`](.env.example). **Nunca commite valores reais** (`.env.local` está no `.gitignore`).

| Variável | Onde é usada | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | chave pública; o acesso é controlado pelo RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor e scripts | ignora o RLS — nunca com prefixo `NEXT_PUBLIC_` |
| `CRON_SECRET` | `/api/keep-alive` | a Vercel envia como `Authorization: Bearer …` |
| `SUPABASE_DB_URL` | só GitHub Actions (backup) | secret do repositório, não da Vercel |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | só servidor (opcional) | análise por IA em Resultados; sem as duas, a seção some |

## 3. Supabase: projeto, migrações e autenticação

1. Crie o projeto na região **South America (São Paulo)**, plano gratuito.
2. Vincule e aplique as migrações de [`supabase/migrations/`](supabase/migrations):
   ```bash
   supabase link --project-ref <ref-do-projeto>
   supabase db push
   ```
   Toda mudança de schema entra como nova migração. **Não altere o banco pelo painel** sem gerar a migração correspondente.
3. **Autenticação** (Authentication → Sign In / Providers e URL Configuration):
   - desative *Allow new users to sign up* (sem cadastro público);
   - *Site URL* = endereço de produção (ex.: `https://sistema-cooesa.vercel.app`); inclua `http://localhost:3000` nas *Redirect URLs*;
   - modelo de e-mail **Reset Password**: troque o link por
     ```
     {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&proximo=/redefinir-senha
     ```
4. **Senha e verificação em dois passos** (Authentication → Sign In / Providers e Multi-Factor):
   - *Minimum password length* = 10 e exija letras e números (a tela de troca de senha já pede 10; o Supabase precisa pedir também);
   - deixe **TOTP** habilitado em *Multi-Factor*. Cada usuário ativa a verificação em **Minha conta** (menu lateral)
     com um aplicativo autenticador. O banco só libera os dados depois do código (migração
     `20261007130000_verificacao_dois_passos.sql`), então uma senha vazada não basta nem pela API.
5. **Primeiro administrador**: `npm run criar-admin -- email@cooesa.com.br "Nome completo"`. Cria a conta com senha provisória
   (mostrada uma vez) ou, se a conta já existe, só a promove a admin. Contas criadas pelo painel do Supabase começam como
   **leitura**; o admin ajusta os papéis em **Configurações → Usuários e permissões**.

## 4. Carga da planilha e conferência

```bash
npm run seed
```

- Lê `data/cooesa_dados.json` (extraído da planilha por `tools/etl_planilha.py`) e chama a função `importar_planilha`
  numa única transação. É **idempotente**: rodar de novo não duplica nem sobrescreve nada.
- No fim confere os números da seção 4.6 da especificação (1.059 registros, 340 contratos, 32,1% de sucesso, somas de
  valores e notas…) e marca cada um como OK ou DIVERGENTE. Numa carga nova, qualquer divergência encerra com erro.
- `npm run conferir` repete só a conferência. Depois de correções feitas no sistema (clientes unificados,
  acompanhamentos vinculados), alguns números mudam de propósito — o script avisa em vez de acusar erro. As correções
  em lote ficam documentadas em `docs/correcoes-*.md` (ex.: [30/09/2026](docs/correcoes-2026-09-30.md)).
- `data/` contém dados pessoais (LGPD): nunca mova para `public/`. `data/Acompanhamento_de_Contratos.xls` é a fonte
  histórica e **não deve ser editada**.

## 5. Deploy na Vercel

1. **O repositório no GitHub precisa ser privado** (`data/` tem nomes e telefones de contatos).
2. Importe o repositório na Vercel (framework Next.js detectado automaticamente).
3. Em *Settings → Environment Variables* cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. Atualize a *Site URL* do Supabase (seção 3) com o domínio da Vercel.

**Anti-pausa.** O Supabase gratuito pausa o projeto após 7 dias sem atividade. O [`vercel.json`](vercel.json) agenda
`/api/keep-alive` às segundas e quintas, 12h UTC. A rota exige o `CRON_SECRET` e faz uma consulta levíssima
(`keep_alive()`). Para testar: `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/keep-alive`.

## 6. Backup e restauração

**Automático (semanal).** O workflow [`.github/workflows/backup.yml`](.github/workflows/backup.yml) roda todo domingo
(e sob demanda em *Actions → Backup do banco → Run workflow*). Faz `pg_dump` dos schemas `public`, `auth` e `storage`
e guarda o arquivo `cooesa-AAAA-MM-DD.dump` como artefato por **90 dias**.

Configuração: em *Settings → Secrets and variables → Actions* crie `SUPABASE_DB_URL` com a string do
*Session pooler* (Supabase → Connect → Session pooler), já com a senha:
`postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`.

**Manual.** Em **Configurações → Backup manual**, o admin baixa todas as tabelas em JSON (cópia completa) ou Excel
(uma aba por tabela, para consulta). Os arquivos têm dados pessoais: guarde em local restrito.

**Restaurar** (a partir do `.dump` do GitHub Actions):

1. Baixe o artefato em *Actions → execução desejada → Artifacts* e descompacte.
2. Prefira restaurar num **projeto Supabase novo** e conferir antes de trocar as chaves na Vercel.
3. Com o cliente PostgreSQL 17 instalado:
   ```bash
   # só os dados do sistema (tabelas, views, funções e triggers do schema public)
   pg_restore --no-owner --no-privileges --clean --if-exists --schema=public \
     -d "postgresql://postgres.<ref-novo>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
     cooesa-AAAA-MM-DD.dump
   ```
   Para recuperar também os usuários, restaure o schema `auth` do mesmo arquivo **antes** do `public`
   (`--schema=auth --data-only`), num projeto novo sem usuários.
4. Rode `npm run conferir` apontando para o projeto restaurado.

## 7. Papéis e segurança

| Papel | Pode |
|---|---|
| **leitura** | consultar tudo (acervo, relatórios, histórico) |
| **editor** | + criar e editar propostas, notas fiscais, acompanhamentos, empresas (sem renomear) e contatos; marcar pendências como revisadas |
| **admin** | + excluir registros, renomear e unificar empresas, aplicar o status sugerido, alterar alíquotas, gerenciar papéis, gerar backup |

- **RLS em todas as tabelas**; as views usam `security_invoker`, então o RLS vale nelas também. As ações de servidor
  checam o papel antes de gravar (primeira barreira) e o banco recusa o que o papel não permite (segunda).
- `historico_alteracoes` é alimentada por triggers e **não pode ser alterada nem apagada** (nem pela service role).
- A service role só é usada no servidor: rota de keep-alive, tela de usuários (listar contas do Auth) e scripts.
- Scripts com a service role devem enviar o cabeçalho `x-origem-alteracao` (quem autorizou e por quê), que vai para o
  histórico como autor. **Só texto sem acentos**: cabeçalhos HTTP não aceitam acentos e a chamada falha.
- **LGPD**: o campo `contato` só aparece no detalhe do registro (usuário logado); listas e exportações não o incluem;
  nada de contato vai para URLs ou logs.
- Numeração: novos registros continuam a partir de 1060. Pode haver lacunas (uma gravação recusada consome o número),
  o que é normal em sequências do PostgreSQL.

### Cadastrar

A área **Cadastrar** (`/cadastrar`, só editor e admin) reúne: **nova proposta** em quatro etapas (cliente → objeto
técnico → proposta comercial → revisão), **atualizar situação** de propostas em aberto (com anotação, motivo da perda
e valor do vencedor), nova empresa e nova nota fiscal. A proposta guarda dados de engenharia opcionais: obra,
município/UF, cliente final, potência (MW), tensão (kV), extensão (km), descrição técnica, modalidade, edital, revisão,
validade, prazo, homem-hora, responsável técnico, concorrentes e motivo da perda. O rascunho fica salvo no aparelho
e uma chave de envio impede proposta duplicada por clique duplo. Migração:
`supabase/migrations/20261009120000_cadastro_propostas.sql` (aplicar com `supabase db push`).

### Empresas

A área **Empresas** (rota `/clientes`) é o cadastro de clientes e de empresas em prospecção: status de relacionamento
(Prospecção, Proposta em andamento, Cliente ativo, Cliente inativo, Não atender), razão social, CNPJ validado, setor,
cidade/UF, site, responsável, origem e contatos. Valores (proposto, contratado P e T, faturado) **não são digitados**:
vêm sempre das propostas e notas. Para as empresas da planilha, o sistema calcula um **status sugerido** e o admin
aplica em lote em *Empresas → Revisar e aplicar as sugestões*; status escolhidos à mão nunca são sobrescritos.
Os **contatos** (tabela `contatos_empresa`) são dados pessoais: aparecem só no detalhe da empresa e ficam fora
das listas e exportações (entram no backup manual, que é restrito ao admin).
Migração: `supabase/migrations/20261008120000_cadastro_empresas.sql` (aplicar com `supabase db push`).

## 8. Testes

```bash
npm test
```

Os testes do banco sobem um PostgreSQL em memória ([PGlite](https://pglite.dev)) com um ambiente Supabase simulado
(`tests/db/supabase-shim.sql`), aplicam todas as migrações e a carga real da planilha. Cobrem: todos os números da
seção 4.6, idempotência da carga, RLS por papel (anônimo, sem perfil, leitura, editor, admin), histórico de alterações,
unificação de clientes, e as regras de % de sucesso e soma P/T.

**Ponta a ponta (navegador real).** `tests/e2e/` cobre login, senha errada, todas as áreas a partir do
Painel de Controle, busca e detalhe, exportação CSV (sem contatos) e o menu do celular. São **só de leitura**.
Crie uma conta de papel *leitura*, sem verificação em dois passos, só para os testes:

```bash
npm run build && npm start                         # em outro terminal
E2E_EMAIL=teste@... E2E_SENHA=... npm run e2e      # E2E_CANAL=msedge usa o Edge do Windows
```

**Integração contínua.** `.github/workflows/ci.yml` roda formatação, lint, tipos, testes e build a cada push.

## 9. Estrutura do código

```
src/app/(sistema)/        telas logadas: painel, registros, currículo, faturamento, clientes, pendências, configurações
src/app/login, auth/      login, recuperação de senha, confirmação de links de e-mail
src/app/api/keep-alive/   rota do cron anti-pausa
src/components/           layout, logo, gráficos (SVG próprio), tabela, histórico
src/lib/                  formatação pt-BR, situações, filtros, exportação, clientes Supabase
src/proxy.ts              renova a sessão e manda para o login quem não está autenticado
supabase/migrations/      schema, triggers, views, RLS e funções (importação, unificação)
scripts/                  seed, criar-admin, correções em lote documentadas
tests/                    testes de regras e de banco
data/  tools/  docs/      planilha original, JSON extraído, script de extração, especificação
```

Dependências de produção (mantidas no mínimo): `next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `zod`
(validação de toda entrada) e `exceljs` (exportação Excel e backup). Gráficos são SVG próprio; o PDF do currículo usa a
impressão do navegador, com cabeçalho da Cooesa.

## 10. Pendências em aberto com o dono

- **Logo**: a versão vetorial em `public/brand/logo-cooesa-*.svg` (chapada, sem relevo) foi redesenhada a partir do
  original e **precisa de aprovação do dono antes de ser usada fora do sistema**.
- **Coluna “K COOESA COM ADM”** da planilha (15%, depois 30% a partir de maio/2020): significado não confirmado;
  **nenhum cálculo usa essa coluna**.
- **Notas fiscais de 2025 e 2026**: a planilha só tem abas de notas até 2024. Cadastre pela tela Faturamento ou envie a
  planilha atualizada para estender a carga.
- **32 pendências de dados** que dependem de conhecimento da empresa (datas ambíguas, pares de clientes, valores em
  milhões): lista e motivos em [`docs/correcoes-2026-09-30.md`](docs/correcoes-2026-09-30.md#o-que-ficou-para-decisão-humana-32).
- **Futuro** (não construído, schema preparado): anexos em PDF no Supabase Storage, cadastro de CATs e acervo técnico,
  monitoramento de licitações.
