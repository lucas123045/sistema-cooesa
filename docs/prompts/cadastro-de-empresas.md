# Prompt — Cadastro de empresas no Sistema Cooesa

Você vai acrescentar ao Sistema Cooesa um **cadastro completo de empresas**: criar, ver e editar empresas com
status de relacionamento, dados cadastrais, contatos, as propostas de cada uma e os valores envolvidos — tudo de
forma simples, inclusive no celular.

## 1. Antes de começar

1. Leia `docs/PROMPT.md` (especificação original — vale tudo dela, principalmente a regra de ouro e a seção 8 de
   identidade visual), `README.md` e `AGENTS.md`. Este projeto usa **Next.js 16**: consulte
   `node_modules/next/dist/docs/` antes de escrever código (proxy em vez de middleware, `params`/`searchParams`
   assíncronos).
2. Estude o que já existe e **reaproveite**: `supabase/migrations/` (tabela `clientes`, view `vw_clientes`, função
   `unificar_clientes`, triggers de histórico, RLS), `src/app/(sistema)/clientes/`, `src/app/(sistema)/registros/`
   (padrão de formulário com zod + `useFormAcao`, filtros na URL, paginação, exportação), `src/components/`
   (`CabecalhoPagina`, `Icone`, `SeloSituacao`, `Historico`, `tabela.tsx`) e os testes em `tests/`.
3. Apresente um **plano curto** (tabelas/colunas, telas, ordem de entrega) e espere minha confirmação antes de
   escrever a migração.

## 2. Decisões já tomadas

- **Não crie uma tabela paralela de empresas.** A tabela `clientes` já é o cadastro de empresas: 329 registros,
  ligados às propostas (`registros.cliente_id`) e às notas (`notas_fiscais.cliente_id`). Enriqueça-a com novas
  colunas numa migração nova em `supabase/migrations/`. Mantenha `nome` como está (único, em maiúsculas): a carga
  da planilha, a busca e a unificação dependem dele.
- **Na interface, a área passa a se chamar "Empresas"**, porque passa a incluir quem ainda não é cliente
  (prospecção). Rotas, tabela e código podem continuar como `clientes`, para não quebrar links e testes.
- **Valores não são digitados no cadastro da empresa.** O valor proposto, o contratado (P total e T mensal, sempre
  separados), o faturado e a taxa de sucesso continuam **calculados** a partir das propostas e notas, nas views.
  Nada de campo "valor" solto na empresa, que ficaria desatualizado.
- Empresas que já existem ficam com os campos novos **vazios**. Não invente nem preencha dados delas.

## 3. Dados

### 3.1 Empresa (colunas novas em `clientes`)

| Campo | Observação |
|---|---|
| `status` | Vocabulário fixo, com `check`: **Prospecção**, **Proposta em andamento**, **Cliente ativo**, **Cliente inativo**, **Não atender**. Legado sem status. Para as 329 empresas existentes, ofereça uma **sugestão automática** (ex.: tem contrato em andamento → Cliente ativo), mas só grave quando um usuário confirmar. |
| `nome_fantasia` | O `nome` atual continua sendo o nome curto usado no sistema. |
| `razao_social` | |
| `cnpj` | Opcional, único quando preenchido, guardado só com dígitos e **validado pelos dígitos verificadores** (zod no formulário + `check` no banco). Exibido como 00.000.000/0000-00. |
| `setor` | Reaproveite os setores da árvore de pesquisa (`taxonomia`) como sugestão. |
| `cidade`, `uf` | `uf` com as 27 siglas. |
| `site` | |
| `responsavel` | Quem cuida da conta na Cooesa (sugira os gerentes já usados em `registros.gerente`). |
| `origem` | Como chegou (indicação, licitação, site, cliente antigo…), texto curto. |
| `observacoes` | |
| `atualizado_em`, `atualizado_por` | Como em `registros`, com os mesmos triggers de carimbo. |

### 3.2 Contatos da empresa (tabela nova `contatos_empresa`)

`nome`, `cargo`, `email`, `telefone`, `principal` (boolean, no máximo um por empresa), `observacoes`, carimbos.
São **dados pessoais (LGPD)**: só usuários logados leem; nunca entram em listas gerais, exportações, URLs ou logs;
aparecem só no detalhe da empresa. O campo `registros.contato` (texto antigo da planilha) continua intocado.

### 3.3 Regras de banco

- RLS em tudo: **leitura** só lê; **editor** cria e edita empresas e contatos; **admin** também exclui e unifica.
- Histórico de alterações (`registrar_historico`) também em `contatos_empresa`.
- Atualize `unificar_clientes` para levar junto os contatos e preencher os campos vazios do destino com os da
  origem, **sem sobrescrever** o que o destino já tem.
- Atualize `vw_clientes` (ou crie uma view nova) com os campos novos + os totais calculados e a data da última
  proposta, para a lista e o detalhe.

## 4. Telas

Siga o padrão visual das telas atuais: tokens de `globals.css`, ícones de `Icone.tsx` e tabelas que viram cartões
no celular (`tabela-cartoes` com `data-label`). Nenhuma dependência nova sem justificativa.

1. **Lista de empresas** (`/clientes`, título "Empresas")
   - Busca sem acentos (nome, razão social, CNPJ), filtros por **status**, setor, UF e responsável, ordenação por
     coluna, paginação no servidor, filtros na URL.
   - Colunas: empresa (nome + razão social), status (selo com cor própria, consistente com o resto do sistema),
     cidade/UF, propostas, contratos, contratado (P), última proposta.
   - Atalhos de status ("Prospecção", "Clientes ativos"…) como na lista de propostas.
   - Botão **"Nova empresa"** (editor/admin) e exportação Excel/CSV **sem contatos**.
2. **Cadastro e edição** (`/clientes/nova`, `/clientes/[id]/editar`)
   - Formulário curto em seções: Identificação (nome, razão social, CNPJ), Relacionamento (status, responsável,
     origem, setor), Localização (cidade, UF, site), Observações.
   - Ao digitar o nome, **avise se já existe empresa parecida** (mesmo prefixo, mesmo CNPJ, nome sem acento
     igual), para evitar duplicatas como as que estão hoje em Pendências.
   - Erros por campo sem perder o que foi digitado (`useFormAcao`), validação no servidor com zod.
3. **Detalhe da empresa** (`/clientes/[id]`)
   - Cabeçalho com nome, status, CNPJ formatado e ações (Editar, Nova proposta, Unificar só para admin — a prévia
     de unificação que já existe deve continuar).
   - Blocos: **Resumo** (propostas, contratos, taxa de sucesso, contratado P, contratado T/mês, faturado) ·
     **Dados cadastrais** · **Contatos** (adicionar, editar e remover na própria tela, sem trocar de página; marcar
     o principal; link `tel:` e `mailto:`) · **Propostas e contratos** (a lista que já existe) · **Notas fiscais** ·
     **Histórico** (empresa e contatos).
   - Mudar o **status** deve ser rápido: um seletor no cabeçalho, salvo na hora, sem abrir o formulário inteiro.
4. **Nova proposta já com a empresa**
   - O botão "Nova proposta" no detalhe abre `/registros/novo?cliente=<id>` com a empresa preenchida.
   - Ao cadastrar uma proposta para uma empresa em **Prospecção**, sugira (não force) mudar o status para
     **Proposta em andamento**.
5. **Painel de Controle e menu**
   - Atualize o cartão e o item de menu para "Empresas" (o Painel de Controle continua só com as opções de
     páginas, sem números).

## 5. Qualidade

- **Testes** (Vitest + PGlite, mesmo padrão de `tests/db/`): RLS de `contatos_empresa` por papel; CNPJ válido e
  inválido; unicidade de CNPJ; unificação levando contatos sem sobrescrever o destino; status fora do vocabulário
  recusado; empresas legadas sem status continuam válidas. Testes unitários para a validação de CNPJ e a sugestão
  automática de status.
- Rode `npm run format`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` antes de cada commit.
- Acrescente ao `tests/e2e/navegacao.spec.ts` uma verificação só de leitura da lista e do detalhe de empresa.
- Celular: toque mínimo de 44 px, campos com 16 px, formulário utilizável a 360 px de largura.
- Atualize o `README.md` (o que mudou e a migração nova).

## 6. Regras de trabalho

- Um commit por etapa (migração + testes · lista · formulário · detalhe e contatos · ajustes de menu e README),
  com mensagem em português.
- **Não rode a migração no banco de produção nem altere dados reais.** Gere a migração; eu aplico com
  `supabase db push`.
- Antes de qualquer ação destrutiva, pergunte.
- Se algo no banco contradisser este pedido, pare e me mostre.

**Fora do escopo agora:** anexos de documentos da empresa, integração com Receita Federal para buscar CNPJ, envio
de e-mail e funil comercial em quadro (kanban). Deixe o modelo de dados sem bloquear essas evoluções.
