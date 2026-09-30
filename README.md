# Sistema Cooesa

Sistema interno de propostas, contratos, clientes e faturamento da Cooesa Engenharia. A aplicação usa Next.js 16 com App Router, TypeScript, Supabase Auth/PostgreSQL e Row Level Security. A interface é em português do Brasil e mantém separados os valores de proposta total (tipo P) e mensal (tipo T).

## Requisitos

- Node.js 20.9 ou superior
- Projeto Supabase configurado na região São Paulo
- Supabase CLI para aplicar migrações

## Configuração local

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e informe as chaves do seu projeto Supabase.
3. Vincule o CLI ao projeto (`supabase link --project-ref <ref>`) e aplique as migrações versionadas com `supabase db push`.
4. Crie o primeiro administrador com `npm run criar-admin -- email@cooesa.com.br "Nome completo"`. O comando gera uma senha provisória e a mostra uma única vez.
5. Importe o acervo histórico com `npm run seed`.
6. Inicie o ambiente local com `npm run dev`.

O `seed` é idempotente. Ele importa `data/cooesa_dados.json` usando a `SUPABASE_SERVICE_ROLE_KEY`, confere os indicadores históricos e falha se os totais esperados não baterem. Preserve o arquivo original em `data/`; ele contém informações comerciais e pessoais e não deve ser movido para `public/`.

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública; o acesso aos dados é controlado pelo RLS.
- `SUPABASE_SERVICE_ROLE_KEY`: segredo exclusivo do servidor e dos scripts de carga/administração. Nunca exponha no navegador.
- `CRON_SECRET`: segredo enviado como `Authorization: Bearer ...` para `/api/keep-alive`.
- `SUPABASE_DB_URL`: conexão de banco usada somente em backups externos.

O endpoint `/api/keep-alive` chama a função SQL de manutenção com a service role e só aceita o segredo de cron configurado. Agende a chamada diária no serviço de hospedagem; não inclua a service role no agendamento.

## Papéis

- **leitura**: consulta o acervo e os relatórios.
- **editor**: cria e altera propostas, notas fiscais, acompanhamentos e marca pendências como revisadas.
- **admin**: também administra alíquotas, unifica clientes e pode excluir registros.

As ações de servidor verificam o papel, e as tabelas aplicam RLS como segunda barreira. Contas não têm cadastro público. Crie o primeiro administrador pelo script; um administrador cria novas contas no Supabase Auth e ajusta os papéis em **Configurações → Usuários e permissões**. Usuários novos começam com papel de leitura.

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: build de produção.
- `npm start`: servidor de produção.
- `npm run typecheck`: verificação TypeScript.
- `npm run lint`: ESLint.
- `npm test`: testes automatizados.
- `npm run seed`: carga e conferência do acervo histórico.

## Banco e operação

Toda mudança de schema deve entrar em `supabase/migrations/` e ser aplicada pela Supabase CLI. Não altere o banco manualmente pelo painel sem criar uma migração correspondente.

O sistema preserva grafias e valores originais da planilha em campos próprios, mantém trilha de auditoria por trigger e sinaliza inconsistências na tela **Pendências de dados**. A tela de faturamento soma notas fiscais; os tributos exibidos são estimativas editáveis nas configurações. O significado da antiga coluna “K COOESA COM ADM” não foi confirmado e não é calculado.

Os contatos comerciais são dados pessoais. A lista e os arquivos exportados omitem o campo de contato; o detalhe do registro só está disponível para usuários autenticados.
