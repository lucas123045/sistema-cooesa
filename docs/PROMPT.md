# Sistema Cooesa — especificação para o Claude Code

Você vai construir, do zero, o sistema interno de propostas, contratos e faturamento da **Cooesa Engenharia S/S Ltda.**, substituindo uma planilha Excel usada desde 2000. Leia este documento inteiro antes de escrever qualquer código. Depois, apresente um plano curto por fases e aguarde minha confirmação antes de começar a Fase 1.

Quem vai trabalhar com você é o Lucas, estudante de Ciência da Computação e filho do dono da empresa. Explique decisões técnicas quando não forem óbvias, mas não trate o Lucas como iniciante.

---

## 1. Contexto do negócio

A Cooesa é uma consultoria de engenharia de São Paulo (Rua Bela Cintra, 299), fundada em 2000 por engenheiros do setor elétrico que participaram do projeto e da construção de grandes hidrelétricas paulistas (Porto Primavera, Ilha Solteira, Rosana, Taquaruçu, Capivara, Três Irmãos). Atua em geração, transmissão e distribuição de energia, segurança de barragens, saneamento e recursos hídricos, estudos ambientais, indústria e comércio, e laudos, perícias e avaliações. Entre os clientes históricos estão CTEEP, CPFL, Eletropaulo, AES Tietê, Siemens, ABB, WEG, Voith, Camargo Corrêa, ANEEL e USP.

Hoje todo o histórico comercial vive numa planilha: cada linha é uma proposta, e a coluna "situação" diz se ela foi perdida, cancelada ou virou contrato. O dono da empresa (pai do Lucas) quer:

1. Ter o acervo de 26 anos organizado, pesquisável e confiável.
2. Um visual de empresa grande, sério e profissional.
3. Base para crescer: anexar PDFs de propostas, contratos e CATs; montar currículo técnico para licitações; no futuro, monitorar licitações.
4. Auditabilidade. A empresa pode passar por processo de venda, então cada alteração precisa ficar registrada (quem, quando, o que mudou).

**Regra de ouro:** nenhum dado histórico pode ser perdido, inventado ou "corrigido" silenciosamente. Quando algo estiver inconsistente, preserve o original e sinalize para revisão humana.

---

## 2. Stack e decisões fixas

- **Next.js** (App Router) + **TypeScript** em modo `strict`.
- **Supabase**: PostgreSQL, Auth e Row Level Security. Storage fica preparado para a fase de anexos. Projeto criado na região **São Paulo (sa-east-1)**, plano **gratuito** por enquanto.
- **Vercel** para hospedagem, com o repositório no GitHub.
- `@supabase/ssr` e `@supabase/supabase-js` para acesso ao banco; `zod` para validar toda entrada de formulário e de rotas de servidor.
- Estilo com CSS baseado em variáveis (tokens) — Tailwind é permitido desde que as cores e fontes venham dos tokens definidos na seção 8, nunca da paleta padrão do Tailwind.
- Gráficos: SVG próprio ou uma biblioteca leve. Mantenha o número de dependências baixo e justifique cada uma que adicionar.
- Migrações do banco versionadas em `supabase/migrations/` (use o Supabase CLI). Nada de alterar o schema pelo painel sem gerar migração.
- Idioma de toda a interface: **português do Brasil**. Moeda em `R$` com `Intl.NumberFormat('pt-BR')`, datas em `dd/mm/aaaa`.

Variáveis de ambiente esperadas (documente no `README` e em `.env.example`, nunca commite valores reais):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só no servidor e nos scripts), `CRON_SECRET`, `SUPABASE_DB_URL` (só para o backup).

---

## 3. Arquivos que acompanham este documento

```
PROMPT.md                              ← este arquivo
data/Acompanhamento_de_Contratos.xls   ← planilha original (fonte da verdade histórica, não editar)
data/cooesa_dados.json                 ← dados já extraídos e limpos da planilha (use este para a carga)
tools/etl_planilha.py                  ← script Python que gerou a extração (referência)
brand/logo-cooesa-original.jpeg        ← logo atual, 200×200, com relevo e sombra
```

`cooesa_dados.json` é a fonte para a carga do banco. Ele já passou por limpeza e por uma unificação manual de 5 grafias de clientes (ver seção 4.5); o `etl_planilha.py` reproduz a extração, mas não essa unificação. Campos vazios foram omitidos dos objetos JSON: trate ausência como `null`.

Mova estes arquivos para dentro do repositório (sugestão: `docs/PROMPT.md`, `data/`, `public/brand/`). **Não** coloque `data/` em nenhuma pasta servida publicamente: contém dados pessoais de contatos.

---

## 4. Entendendo os dados

### 4.1 A planilha original

Ela tem 17 abas. O que importa:

- **Geral**: a tabela mestre, com 1.059 registros numerados de 1 a 1059 (anos 2000 a 2026). É daqui que vêm os `registros`.
- **Critério de Pesquisa**: a "árvore de pesquisa", uma classificação em 5 níveis usada em cada registro (vira `taxonomia`).
- **NFs-Tributos 2020** e **NFs Tributos 2021–2024**: notas fiscais emitidas, com data de emissão, cliente, título do arquivo da NF, valor, data de crédito, e tributos estimados por mês (vira `notas`).
- **2001 a 2006**: versões antigas do acompanhamento com observações de follow-up e valores "a receber" (vira `acompanhamentos`).
- **RESUMO**, **Nº Clientes**, **Currículo Automático**: cálculos derivados da Geral. Não são importados como dados; o sistema deve reproduzir a função delas (ver seção 6).

### 4.2 Registro (`registros` no JSON)

Cada registro é uma proposta que pode ter virado contrato. Campos:

| Campo JSON | Significado |
|---|---|
| `num` | Nº original da planilha (1–1059). É o identificador que a empresa conhece. Novos registros continuam a sequência a partir de 1060. |
| `empresa` | Cliente, em maiúsculas. |
| `empresaOriginal` | Presente só quando o nome foi unificado; guarda a grafia da planilha. |
| `contato` | Texto livre com nome e, às vezes, telefone do contato no cliente. **Dado pessoal (LGPD).** |
| `gerente` | Gerente de contrato do lado da Cooesa (75 nomes distintos; "JRCVeiga" aparece em 529 registros). |
| `escopo` | Descrição do serviço. Campo principal de busca. |
| `situacao` | Uma das 7 situações da seção 4.3 (1 registro, Nº 368, está sem situação). |
| `dataIni` / `dataEnc` | Datas ISO (`aaaa-mm-dd`) de início e encerramento, quando interpretáveis. |
| `dataIniTexto` / `dataEncTexto` | Texto original quando a data estava digitada de forma ambígua ou errada (ex.: `125.04.06`, `jan./05`). Se houver os dois, a data ISO foi inferida a partir do texto (datas do tipo "mês/ano" viram o dia 1º). |
| `tipo` | `P` = produção/serviço, **valor total**. `T` = trabalho/mão de obra, **valor mensal**. Nunca some valores `T` com `P` sem deixar isso explícito. |
| `valor` | Valor da proposta da Cooesa em R$ (numérico). |
| `valorTexto` | Texto original quando o valor não era número (ex.: `15 milhões`, `35,00 e 25,00`, `VARIÁVEL`, `-`). Nesses casos `valor` é nulo. |
| `valorVencedor` | Valor do concorrente vencedor, quando conhecido (raríssimo). |
| `entidade` | `Cooesa Ltda` ou `Cooperativa` — por qual entidade a proposta foi feita (vinha na coluna OBS como "Ltda"/"Coo"). |
| `obs` | Outras observações. |
| `ano` | Ano do registro. |
| `setor`, `area`, `empreendimento`, `servico`, `especialidade` | Os 5 níveis da árvore de pesquisa (A a E). Vazios em parte dos registros. |
| `acompanhamentos` | Lista de anotações históricas vindas das abas 2001–2006: `fonte`, `situacaoNaEpoca`, `obs`, `aReceber`. |

### 4.3 Situações (vocabulário fixo, use exatamente estes textos)

| Situação | Quantidade | Grupo |
|---|---|---|
| Proposta colocada | 9 | Aguardando resposta |
| Proposta colocada - negativa | 688 | Perdida |
| Proposta cancelada | 16 | Cancelada |
| Proposta em litígio | 0 | Litígio |
| Contrato em andamento | 6 | Contrato |
| Contrato encerrado | 334 | Contrato |
| Contrato em litígio | 5 | Litígio |

A empresa define **"contratos totais" = encerrados + em andamento (340)** e **"% de sucesso das cotações" = contratos totais ÷ total de propostas (32,1%)**. Mantenha exatamente essa definição.

### 4.4 Notas fiscais (`notas` no JSON)

121 notas de 2020 a 2024: `numero` (da NF-e, extraído do título), `dataEmissao`, `dataCredito`, `empresa`, `titulo`, `valor`, `ano`, `registroNum` (vínculo com o registro, presente em apenas 6 notas de 2020), `aba` e `linha` (origem exata na planilha, guarde para auditoria). 7 notas de 2023–2024 estão sem empresa nem data na planilha: importe assim mesmo e sinalize.

Alíquotas estimadas de tributos usadas na planilha (sobre o valor da nota): IRPJ 4,0219%, CSLL 2,5137%, COFINS 2,5003%, PIS 0,5413%, INSS 3,9968%, ISS 3,1840% (total ≈ 16,758%). Guarde-as como configuração editável, não como constantes no código. A planilha também tem uma coluna "K COOESA COM ADM" de 15% (30% a partir de maio/2020) cujo significado exato ainda precisa ser confirmado com o dono — **não implemente cálculo com ela**; deixe só anotado como pendência no README.

### 4.5 Inconsistências conhecidas (devem aparecer na tela de Pendências)

- 9 registros com data de início digitada errada (preservada em `dataIniTexto`) e 18 com data de encerramento em formato "mês/ano".
- 15 registros com valor em texto (`valorTexto`).
- 1 registro sem situação (Nº 368).
- 5 nomes de clientes unificados na extração: SCHAIN→SCHAHIN (Nº 218), DALLACQUA→DALL'ACQUA (Nº 650), BIO ENERGY→BIOENERGY (Nº 727), ARCARDIS→ARCADIS (Nº 898), CONCRENAT→CONCREMAT (Nº 970). Outros possíveis duplicados **não** foram unificados e devem ser decididos pelo usuário (ex.: PLANSERV/PLANSERVI, QUANTA/QUANTA CONSULTORIA, VIVAN/VIVAN ENGENHARIA, SINER/SINERCONSULT, GE/GE - GENERAL ELECTRIC, DH/DHIDROVIÁRIO).
- 12 acompanhamentos antigos que não puderam ser ligados com segurança a um registro (`naoVinculados` no JSON).
- Totais de faturamento da planilha que não batem com as notas: em outubro/2020 o total mensal deixou de fora três notas (R$ 47.300,00), e em julho/2024 o total somou só a primeira de três notas (R$ 6.000,00 em vez de R$ 20.000,00). O sistema sempre calcula a partir das notas, nunca de totais digitados.

### 4.6 Números de validação (a carga só está correta se todos baterem)

- 1.059 registros; situações exatamente como na tabela 4.3.
- 340 contratos totais; 32,1% de sucesso.
- 332 clientes distintos após a unificação; 125 clientes que contrataram ao menos uma vez.
- Tipo: 1.006 `P` e 53 `T`.
- Soma de `valor` de todos os registros: R$ 343.681.860,64.
- Soma de `valor` dos contratos (encerrado + andamento) tipo P: R$ 18.323.010,38; tipo T: R$ 1.621.240,00 (mensal).
- 121 notas, total R$ 1.720.180,38. Por ano: 2020 R$ 661.105,37; 2021 R$ 607.569,56; 2022 R$ 220.926,16; 2023 R$ 108.791,79; 2024 R$ 121.787,50.
- 68 acompanhamentos vinculados a registros e 12 não vinculados.

---

## 5. Banco de dados

Projete as migrações seguindo este modelo. Pode refinar nomes e tipos, mas explique qualquer desvio.

**Tabelas**

- `clientes` — `id`, `nome` (único, maiúsculas), `criado_em`.
- `registros` — `num` (PK inteira; sequência começando em 1060 para novos), `cliente_id` (FK), `empresa_original`, `contato`, `gerente`, `escopo` (obrigatório), `situacao` (enum ou `check` com as 7 situações, aceitando nulo só para o legado), `data_ini`, `data_ini_texto`, `data_enc`, `data_enc_texto`, `tipo` (`P`/`T`), `valor` (`numeric(14,2)`), `valor_texto`, `valor_vencedor`, `entidade`, `obs`, `ano`, `setor`, `area`, `empreendimento`, `servico`, `especialidade`, `criado_em`, `criado_por`, `atualizado_em`, `atualizado_por`.
- `acompanhamentos` — `id`, `registro_num` (FK, pode ser nulo para os não vinculados), `fonte`, `situacao_na_epoca`, `obs`, `a_receber`, `empresa_texto` e `escopo_texto` (para os não vinculados), `criado_em`, `criado_por`. Novas anotações feitas no sistema também entram aqui.
- `notas_fiscais` — `id`, `numero`, `data_emissao`, `data_credito`, `cliente_id` (FK, nulo quando ausente), `empresa_texto`, `titulo`, `valor`, `ano`, `registro_num` (FK opcional), `origem_aba`, `origem_linha`, carimbos de auditoria.
- `taxonomia` — os níveis da árvore de pesquisa, carregados de `taxonomia` no JSON.
- `configuracoes` — chave/valor para alíquotas de tributos e outros parâmetros.
- `perfis` — `user_id` (FK para `auth.users`), `nome`, `papel` (`admin`, `editor`, `leitura`).
- `historico_alteracoes` — `id`, `tabela`, `chave`, `acao` (`insert`/`update`/`delete`), `antes` (jsonb), `depois` (jsonb), `usuario`, `quando`. Alimentada por **triggers** em `registros`, `notas_fiscais`, `clientes` e `acompanhamentos`. Ninguém edita nem apaga esta tabela pela aplicação.

Crie índices para busca: `pg_trgm` em `escopo` e `clientes.nome`, e índices simples em `situacao`, `ano`, `area`, `gerente` e `cliente_id`.

**Views** (as contas moram no banco, a interface só exibe):

- `vw_resumo` — total de propostas, encerrados, em andamento, contratos totais, % de sucesso, clientes distintos, clientes que contrataram (mesmas colunas da aba RESUMO).
- `vw_resumo_anual` — por ano: propostas, contratos, % de sucesso, valor proposto e valor contratado (P e T separados).
- `vw_faturamento_mensal` — por ano/mês: soma das notas, quantidade e tributos estimados pelas alíquotas da `configuracoes`.
- `vw_clientes` — por cliente: propostas, contratos, % de sucesso, valor contratado (P), faturado, primeiro e último ano.
- `vw_curriculo` — só contratos (encerrado + andamento) com a classificação completa, para a tela de Currículo.
- `vw_pendencias` — lista unificada das inconsistências da seção 4.5, com tipo, referência e descrição.

**Segurança (RLS em todas as tabelas, sem exceção)**

- Sem cadastro público. Contas criadas só por um `admin` (via painel do Supabase ou rota de servidor protegida).
- `leitura`: só lê. `editor`: lê, cria e edita registros, notas e acompanhamentos. `admin`: tudo, incluindo excluir, unificar clientes, gerenciar usuários e configurações.
- Exclusão de registro é rara e só por `admin`; prefira sempre mudar a situação. O histórico guarda o que foi excluído.
- A `service_role` nunca vai para o navegador.

---

## 6. Carga dos dados

Crie `scripts/seed.ts` (executado com `npx tsx` ou similar) que:

1. Lê `data/cooesa_dados.json`.
2. Insere clientes, registros (preservando o `num` original), acompanhamentos (inclusive os `naoVinculados`, com `registro_num` nulo), notas fiscais (ligando cliente por nome exato e registro por `registroNum`), taxonomia e as alíquotas de tributos.
3. Ajusta a sequência de `num` para continuar em 1060.
4. É **idempotente**: rodar duas vezes não duplica nada.
5. Ao final, consulta as views e imprime cada número da seção 4.6 ao lado do valor esperado, marcando OK ou DIVERGENTE. Se qualquer um divergir, o script termina com erro.

Durante a carga, os triggers de histórico devem registrar a origem como "importação da planilha" (não como um usuário).

---

## 7. Telas

Layout geral: barra lateral fixa com logo e menu à esquerda; conteúdo à direita. No celular, o menu vira barra superior compacta. Toda lista deve funcionar bem com 1.000+ linhas (paginação no servidor ou carregamento incremental), com busca que ignora acentos e maiúsculas.

1. **Login** — e-mail e senha, com o logo. Recuperação de senha por e-mail.
2. **Painel** (substitui a aba RESUMO)
   - Destaque principal: **linha do tempo de 2000 até o ano atual**, com barras de propostas × contratos por ano e a taxa de sucesso. É a tela que conta os 26 anos da empresa; capriche nela.
   - Indicadores: contratos totais, % de sucesso, contratos em andamento, propostas aguardando resposta, faturamento dos últimos 12 meses (a partir das notas), registros em litígio.
   - Listas curtas: "Aguardando resposta", "Contratos em andamento", "Principais clientes" e distribuição dos contratos por área.
3. **Propostas e contratos** (substitui a aba Geral)
   - Tabela com Nº, cliente + escopo, área, data, situação, valor (com indicação `/mês` quando tipo T).
   - Filtros: busca livre, situação (e atalhos "Só contratos", "Aguardando"), ano ou intervalo de anos, setor/área, gerente, entidade.
   - Ordenação por coluna, filtros refletidos na URL (para poder compartilhar um link de busca), exportação do resultado filtrado para CSV/Excel.
   - Detalhe do registro: todos os campos, textos originais preservados quando houver, acompanhamentos em ordem cronológica, notas fiscais vinculadas, e o histórico de alterações daquele registro.
   - Cadastro e edição com validação; os campos da classificação A–E sugerem valores já usados (autocompletar) para evitar novas grafias.
4. **Currículo** (substitui a aba Currículo Automático)
   - Filtros encadeados pelos 5 níveis (setor → área → empreendimento → serviço → especialidade), mostrando só opções que existem nos contratos, mais intervalo de anos e opção de incluir contratos em andamento.
   - Resultado: lista de contratos que comprovam experiência, com cliente, escopo, ano e classificação; valor é opcional (liga/desliga), porque currículo para licitação às vezes não mostra valores.
   - Exportar para Excel e para PDF com o cabeçalho da Cooesa.
5. **Faturamento** (substitui as abas NFs-Tributos)
   - Seletor de ano; indicadores de faturado no ano, número de notas, média mensal e tributos estimados; gráfico mensal; comparativo anual.
   - Tabela de notas com número, emissão, crédito, cliente, título, valor e registro vinculado. Cadastro e edição de notas, com vínculo a um registro.
   - Destaque para notas emitidas sem data de crédito (a receber).
6. **Clientes** (substitui a aba Nº Clientes)
   - Tabela de `vw_clientes` com ordenação. Detalhe do cliente com todo o histórico de propostas, contratos e notas.
   - Ação de `admin`: **unificar clientes** (escolher o nome que fica; todos os registros e notas passam para ele; o nome antigo fica registrado no histórico e em `empresa_original` dos registros afetados). Mostre uma prévia de quantos registros serão afetados antes de confirmar.
7. **Pendências de dados**
   - Lista de `vw_pendencias` agrupada por tipo, com link direto para corrigir cada item. Ao corrigir, a pendência some. É aqui que o dono vai limpar o legado aos poucos.
8. **Configurações** (só `admin`)
   - Usuários e papéis, alíquotas de tributos, e **backup manual**: botão que gera um arquivo com todas as tabelas (JSON e Excel).

---

## 8. Identidade visual

**Direção.** Os clientes da Cooesa são Siemens, ABB, WEG, CTEEP. O sistema deve ter a sobriedade dos portais corporativos dessas empresas: organizado, denso de informação, preciso. Nada de gradientes decorativos, ilustrações, ícones fofos ou aparência de aplicativo de startup. A sensação de "empresa grande" vem de alinhamento rigoroso, tipografia firme e números bem apresentados.

**Logo.** O logo atual (`brand/logo-cooesa-original.jpeg`) é um logotipo tipográfico "Cooesa" em letras redondas e largas, de desenho geométrico (próximo de Century Gothic), com acabamento metálico em relevo, sombra projetada e degradê azul-aço do claro (topo) ao quase preto (base). O arquivo é pequeno (200×200) e o relevo não combina com uma interface limpa. Então:
- Recrie o logotipo como **SVG chapado** (sem relevo e sem sombra), fiel à forma das letras, em duas versões: azul Cooesa sobre fundo claro e branca sobre o azul profundo da barra lateral. Deixe claro no README que essa versão precisa de aprovação do dono antes de ser usada fora do sistema.
- Não altere a proporção nem "modernize" o desenho das letras.

**Paleta** (extraída do logo; defina como tokens CSS):

| Token | Cor | Uso |
|---|---|---|
| `--aco-claro` | `#8AB3C3` | séries secundárias de gráficos, detalhes, estados de seleção suaves |
| `--aco-medio` | `#68879D` | textos secundários sobre fundo escuro, bordas de destaque |
| `--azul-cooesa` | `#3E5B7B` | cor principal: botões, links, série principal dos gráficos |
| `--azul-profundo` | `#27364C` | barra lateral, cabeçalhos |
| `--azul-base` | `#0F141D` | fundo do modo escuro, texto de maior contraste |
| `--alerta` | âmbar, algo como `#E0A100` | **única** cor de destaque: aguardando resposta, pendências, notas a receber |
| neutros | cinza-concreto claro para o fundo, branco para superfícies, cinzas para bordas e textos secundários | |

Cores de situação fixas e consistentes em todo o sistema: contrato (verde sóbrio), aguardando (âmbar), perdida (vermelho sóbrio), cancelada (cinza), litígio (laranja escuro). Garanta contraste AA.

**Tipografia.** Uma sans geométrica de letras redondas para títulos e números grandes, ecoando o logo, e uma sans neutra e muito legível para textos e tabelas. Números sempre com algarismos tabulares, alinhados à direita nas tabelas. Carregue as fontes com `next/font`.

**Modo escuro** completo, seguindo a preferência do sistema operacional, com opção de alternar.

**Tela de carregamento.** Enquanto a sessão e os primeiros dados carregam: logo centralizado sobre o azul profundo, com **uma** animação discreta — o degradê azul-aço do logo original preenchendo as letras de baixo para cima, como carga. Curta, sem travar a interface se os dados chegarem rápido, e respeitando `prefers-reduced-motion`.

**Qualidade mínima:** responsivo até 360 px de largura, foco visível no teclado, estados vazios e de erro que dizem o que fazer ("Nenhum contrato com esses filtros. Limpe a busca ou mude o ano."), mensagens de erro sem pedir desculpas e sem vaguezas.

---

## 9. Operação no plano gratuito do Supabase

- **Anti-pausa:** o Supabase gratuito pausa projetos após 7 dias sem atividade no banco. Crie `/api/keep-alive` (protegida por `CRON_SECRET`) que faz uma consulta leve no banco, e agende na Vercel (`vercel.json`, cron duas vezes por semana).
- **Backup automático:** o plano gratuito não oferece retenção de backup. Crie um GitHub Action semanal que roda `pg_dump` usando `SUPABASE_DB_URL` (secret do repositório) e guarda o arquivo como artefato do workflow com retenção de 90 dias. Documente como restaurar.
- **LGPD:** os campos de contato têm nomes e telefones de pessoas. Só usuários logados leem; nada disso vai para logs, URLs ou mensagens de erro.

---

## 10. Fases de entrega

Trabalhe em fases, com um commit ao final de cada uma, e pare para eu revisar antes de seguir.

1. **Fundação:** projeto Next.js, tokens de design, layout com barra lateral, logo SVG, tela de carregamento, login com Supabase Auth, `perfis` e papéis.
2. **Banco e carga:** migrações completas (tabelas, triggers de histórico, views, RLS, índices) e `scripts/seed.ts`. **Critério de aceite:** todos os números da seção 4.6 batem.
3. **Propostas e contratos:** listagem, filtros, detalhe, cadastro, edição, exportação.
4. **Painel.**
5. **Currículo** e **Faturamento.**
6. **Clientes** (com unificação) e **Pendências.**
7. **Configurações, backup e operação:** backup manual, keep-alive, GitHub Action de backup, `README` completo (como rodar local, variáveis, migrações, carga, deploy, restauração de backup).

---

## 11. Regras de trabalho

- Antes de qualquer ação destrutiva (apagar dados, rodar migração que remove coluna, sobrescrever a carga), pergunte.
- Não invente dados de exemplo no banco de produção. Se precisar de dados fictícios para testes, use um projeto ou schema separado.
- Nunca altere `data/Acompanhamento_de_Contratos.xls`.
- Se encontrar na planilha algo que contradiga este documento, pare e me mostre em vez de escolher sozinho.
- Escreva testes para as regras de negócio que importam: cálculo de % de sucesso, soma separando P e T, unificação de clientes e as políticas de RLS por papel.
- Mantenha o código simples de manter: o Lucas vai continuar este sistema depois.

**Futuro (não construir agora, mas não bloquear):** anexos de PDF por registro no Supabase Storage (proposta, contrato, CAT, ART), cadastro de CATs e profissionais do acervo técnico, e um módulo de monitoramento de licitações que cruza editais com o currículo.
