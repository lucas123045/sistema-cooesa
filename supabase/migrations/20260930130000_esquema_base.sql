-- =====================================================================
-- Fase 2 — Esquema base: clientes, registros, acompanhamentos, notas
-- fiscais, taxonomia, configurações, histórico de alterações e pendências.
-- Regra de ouro: nenhum dado histórico é perdido, inventado ou corrigido
-- em silêncio. Textos originais da planilha ficam em colunas *_texto.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Normalização para busca: sem acento, minúsculas, espaços simples.
-- (unaccent não é immutable; o wrapper com dicionário explícito é, e
-- pode ser usado em índices.)
-- ---------------------------------------------------------------------

create function public.f_unaccent(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto)
$$;

create function public.normalizar_busca(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select btrim(regexp_replace(lower(public.f_unaccent(texto)), '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------
-- Situações (vocabulário fixo, seção 4.3) e grupos
-- ---------------------------------------------------------------------

create function public.grupo_situacao(situacao text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case situacao
    when 'Proposta colocada'            then 'aguardando'
    when 'Proposta colocada - negativa' then 'perdida'
    when 'Proposta cancelada'           then 'cancelada'
    when 'Proposta em litígio'          then 'litigio'
    when 'Contrato em andamento'        then 'contrato'
    when 'Contrato encerrado'           then 'contrato'
    when 'Contrato em litígio'          then 'litigio'
  end
$$;

-- "Contratos totais" na definição da empresa: encerrados + em andamento.
create function public.e_contrato_total(situacao text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(situacao in ('Contrato encerrado', 'Contrato em andamento'), false)
$$;

-- =====================================================================
-- Tabelas
-- =====================================================================

create table public.clientes (
  id         bigint generated always as identity primary key,
  nome       text not null unique,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  constraint clientes_nome_preenchido check (btrim(nome) <> ''),
  constraint clientes_nome_maiusculo check (nome = upper(nome))
);
comment on table public.clientes is 'Clientes (empresas), nome único em maiúsculas.';

create sequence public.registros_num_seq as integer start with 1060;

create table public.registros (
  num             integer primary key default nextval('public.registros_num_seq'),
  cliente_id      bigint not null references public.clientes (id),
  empresa_original text,
  contato         text,
  gerente         text,
  escopo          text,
  situacao        text,
  data_ini        date,
  data_ini_texto  text,
  data_enc        date,
  data_enc_texto  text,
  tipo            char(1) not null,
  valor           numeric(14, 2),
  valor_texto     text,
  valor_vencedor  numeric(14, 2),
  entidade        text,
  obs             text,
  ano             smallint not null,
  setor           text,
  area            text,
  empreendimento  text,
  servico         text,
  especialidade   text,
  busca           text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references auth.users (id) on delete set null,
  atualizado_em   timestamptz,
  atualizado_por  uuid references auth.users (id) on delete set null,

  constraint registros_situacao_valida check (
    situacao in ('Proposta colocada', 'Proposta colocada - negativa', 'Proposta cancelada',
                 'Proposta em litígio', 'Contrato em andamento', 'Contrato encerrado', 'Contrato em litígio')
  ),
  -- Situação e escopo são obrigatórios, exceto no legado da planilha (Nº 368 sem situação, Nº 108 sem escopo).
  constraint registros_situacao_obrigatoria check (situacao is not null or num <= 1059),
  constraint registros_escopo_obrigatorio check (nullif(btrim(escopo), '') is not null or num <= 1059),
  constraint registros_tipo_valido check (tipo in ('P', 'T')),
  constraint registros_entidade_valida check (entidade in ('Cooesa Ltda', 'Cooperativa')),
  constraint registros_ano_valido check (ano between 1990 and 2100),
  constraint registros_valor_nao_negativo check (valor is null or valor >= 0)
);
alter sequence public.registros_num_seq owned by public.registros.num;

comment on table public.registros is 'Propostas (e contratos em que se tornaram). num = Nº original da planilha; novos a partir de 1060.';
comment on column public.registros.tipo is 'P = produção/serviço (valor total); T = trabalho/mão de obra (valor MENSAL). Nunca somar P com T.';
comment on column public.registros.contato is 'Dado pessoal (LGPD): nome e telefone do contato no cliente.';
comment on column public.registros.busca is 'Texto normalizado para busca (mantido por trigger). Não editar.';

create table public.acompanhamentos (
  id                bigint generated always as identity primary key,
  registro_num      integer references public.registros (num) on delete cascade,
  fonte             text not null default 'Sistema',
  situacao_na_epoca text,
  obs               text,
  a_receber         numeric(14, 2),
  empresa_texto     text,
  escopo_texto      text,
  chave_importacao  text unique,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references auth.users (id) on delete set null,
  constraint acompanhamentos_vinculo check (registro_num is not null or empresa_texto is not null)
);
comment on table public.acompanhamentos is 'Anotações de follow-up. As das abas 2001–2006 vêm da planilha; novas entram pelo sistema.';

create table public.notas_fiscais (
  id             bigint generated always as identity primary key,
  numero         text,
  data_emissao   date,
  data_credito   date,
  cliente_id     bigint references public.clientes (id),
  empresa_texto  text,
  titulo         text,
  valor          numeric(14, 2) not null,
  ano            smallint not null,
  registro_num   integer references public.registros (num) on delete set null,
  origem_aba     text,
  origem_linha   integer,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users (id) on delete set null,
  atualizado_em  timestamptz,
  atualizado_por uuid references auth.users (id) on delete set null,
  constraint notas_valor_positivo check (valor > 0),
  constraint notas_ano_valido check (ano between 1990 and 2100),
  constraint notas_origem_unica unique (origem_aba, origem_linha)
);
comment on table public.notas_fiscais is 'Notas fiscais emitidas. origem_aba/origem_linha apontam a célula de origem na planilha (auditoria).';

create table public.taxonomia (
  id              bigint generated always as identity primary key,
  setor           text not null,
  area            text,
  empreendimentos text,
  servicos        text,
  especialidades  text,
  ordem           integer not null default 0,
  constraint taxonomia_setor_area_unicos unique nulls not distinct (setor, area)
);
comment on table public.taxonomia is 'Árvore de pesquisa da aba "Critério de Pesquisa" (níveis A a E).';

create table public.configuracoes (
  chave          text primary key,
  valor          jsonb not null,
  descricao      text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
comment on table public.configuracoes is 'Parâmetros editáveis (ex.: alíquotas estimadas de tributos, em % sobre o valor da nota).';

create table public.historico_alteracoes (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  chave      text not null,
  acao       text not null check (acao in ('insert', 'update', 'delete')),
  antes      jsonb,
  depois     jsonb,
  usuario_id uuid,
  usuario    text not null,
  quando     timestamptz not null default now()
);
comment on table public.historico_alteracoes is 'Trilha de auditoria alimentada por triggers. Ninguém altera nem apaga esta tabela pela aplicação.';

-- Avisos gerados na importação que exigem revisão humana (nomes unificados,
-- totais da planilha que não batem com as notas).
create table public.avisos_importacao (
  id         bigint generated always as identity primary key,
  tipo       text not null,
  chave      text not null,
  referencia text not null,
  descricao  text not null,
  unique (tipo, chave)
);

-- Pendências que um usuário marcou como revisadas (a pendência some da lista).
create table public.pendencias_revisadas (
  tipo        text not null,
  chave       text not null,
  observacao  text,
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_em timestamptz not null default now(),
  primary key (tipo, chave)
);

-- =====================================================================
-- Índices
-- =====================================================================

create index registros_busca_trgm on public.registros using gin (busca extensions.gin_trgm_ops);
create index registros_escopo_trgm on public.registros using gin (public.normalizar_busca(escopo) extensions.gin_trgm_ops);
create index clientes_nome_trgm on public.clientes using gin (public.normalizar_busca(nome) extensions.gin_trgm_ops);
create index registros_situacao_idx on public.registros (situacao);
create index registros_ano_idx on public.registros (ano);
create index registros_area_idx on public.registros (area);
create index registros_gerente_idx on public.registros (gerente);
create index registros_cliente_idx on public.registros (cliente_id);
create index acompanhamentos_registro_idx on public.acompanhamentos (registro_num);
create index notas_cliente_idx on public.notas_fiscais (cliente_id);
create index notas_registro_idx on public.notas_fiscais (registro_num);
create index notas_ano_idx on public.notas_fiscais (ano, data_emissao);
create index historico_chave_idx on public.historico_alteracoes (tabela, chave, quando desc);
create index historico_quando_idx on public.historico_alteracoes (quando desc);

-- =====================================================================
-- Triggers de carimbo (quem criou / quem alterou) e de busca.
-- O Postgres dispara triggers do mesmo evento em ordem alfabética: os prefixos
-- a_, b_, c_ garantem preparar → carimbo de criação → carimbo de atualização.
-- =====================================================================

-- Colunas que não contam como "alteração" (derivadas ou carimbos).
create function public.colunas_ignoradas_auditoria()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['busca', 'atualizado_em', 'atualizado_por']
$$;

create function public.carimbar_criacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := auth.uid();  -- nunca confia no valor enviado pelo cliente
  else
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;
  return new;
end;
$$;

create function public.carimbar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.atualizado_em := null;
    new.atualizado_por := null;
  elsif (to_jsonb(new) - public.colunas_ignoradas_auditoria()) is distinct from
        (to_jsonb(old) - public.colunas_ignoradas_auditoria()) then
    new.atualizado_em := now();
    new.atualizado_por := auth.uid();
  else
    new.atualizado_em := old.atualizado_em;
    new.atualizado_por := old.atualizado_por;
  end if;
  return new;
end;
$$;

create function public.preparar_registro()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cliente text;
begin
  if new.ano is null then
    new.ano := coalesce(extract(year from new.data_ini)::smallint, extract(year from now())::smallint);
  end if;
  select c.nome into v_cliente from public.clientes c where c.id = new.cliente_id;
  new.busca := public.normalizar_busca(concat_ws(' ',
    new.num::text, v_cliente, new.empresa_original, new.escopo, new.gerente, new.obs,
    new.setor, new.area, new.empreendimento, new.servico, new.especialidade, new.valor_texto));
  return new;
end;
$$;

create function public.preparar_nota()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ano is null then
    new.ano := coalesce(extract(year from new.data_emissao)::smallint, extract(year from now())::smallint);
  end if;
  return new;
end;
$$;

create trigger registros_a_preparar before insert or update on public.registros
  for each row execute function public.preparar_registro();
create trigger registros_b_carimbo_criacao before insert or update on public.registros
  for each row execute function public.carimbar_criacao();
create trigger registros_c_carimbo_atualizacao before insert or update on public.registros
  for each row execute function public.carimbar_atualizacao();

create trigger notas_a_preparar before insert or update on public.notas_fiscais
  for each row execute function public.preparar_nota();
create trigger notas_b_carimbo_criacao before insert or update on public.notas_fiscais
  for each row execute function public.carimbar_criacao();
create trigger notas_c_carimbo_atualizacao before insert or update on public.notas_fiscais
  for each row execute function public.carimbar_atualizacao();

create trigger clientes_b_carimbo_criacao before insert or update on public.clientes
  for each row execute function public.carimbar_criacao();
create trigger acompanhamentos_b_carimbo_criacao before insert or update on public.acompanhamentos
  for each row execute function public.carimbar_criacao();

-- Renomear um cliente atualiza a coluna de busca dos seus registros.
create function public.clientes_renomeado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.registros set busca = null where cliente_id = new.id;
  return null;
end;
$$;

create trigger clientes_apos_renomear after update of nome on public.clientes
  for each row when (old.nome is distinct from new.nome)
  execute function public.clientes_renomeado();

-- =====================================================================
-- Histórico de alterações (auditoria)
-- =====================================================================

create function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes   jsonb;
  v_depois  jsonb;
  v_uid     uuid := auth.uid();
  v_origem  text := nullif(current_setting('app.origem', true), '');
  v_usuario text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old) - public.colunas_ignoradas_auditoria();
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := to_jsonb(new) - public.colunas_ignoradas_auditoria();
  end if;
  if tg_op = 'UPDATE' and v_antes = v_depois then
    return null;  -- nada de substantivo mudou
  end if;

  if v_origem is not null then
    v_usuario := v_origem;                       -- ex.: 'importação da planilha'
  elsif v_uid is not null then
    select coalesce(nullif(p.nome, ''), u.email, v_uid::text)
      into v_usuario
      from auth.users u
      left join public.perfis p on p.user_id = u.id
     where u.id = v_uid;
  end if;

  insert into public.historico_alteracoes (tabela, chave, acao, antes, depois, usuario_id, usuario)
  values (
    tg_table_name,
    coalesce(v_depois, v_antes) ->> tg_argv[0],
    lower(tg_op),
    v_antes,
    v_depois,
    v_uid,
    coalesce(v_usuario, 'sistema (' || current_user || ')')
  );
  return null;
end;
$$;

create trigger registros_historico after insert or update or delete on public.registros
  for each row execute function public.registrar_historico('num');
create trigger notas_historico after insert or update or delete on public.notas_fiscais
  for each row execute function public.registrar_historico('id');
create trigger clientes_historico after insert or update or delete on public.clientes
  for each row execute function public.registrar_historico('id');
create trigger acompanhamentos_historico after insert or update or delete on public.acompanhamentos
  for each row execute function public.registrar_historico('id');
create trigger configuracoes_historico after insert or update or delete on public.configuracoes
  for each row execute function public.registrar_historico('chave');

-- O histórico é somente-inserção: bloqueia UPDATE, DELETE e TRUNCATE para todos
-- (inclusive service_role). Só um superusuário, desligando o trigger, conseguiria.
create function public.historico_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico de alterações não pode ser alterado nem apagado.'
    using errcode = '42501';
end;
$$;

create trigger historico_sem_update_delete before update or delete on public.historico_alteracoes
  for each row execute function public.historico_imutavel();
create trigger historico_sem_truncate before truncate on public.historico_alteracoes
  for each statement execute function public.historico_imutavel();

-- =====================================================================
-- Row Level Security — em todas as tabelas, sem exceção
-- =====================================================================

alter table public.clientes enable row level security;
alter table public.registros enable row level security;
alter table public.acompanhamentos enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.taxonomia enable row level security;
alter table public.configuracoes enable row level security;
alter table public.historico_alteracoes enable row level security;
alter table public.avisos_importacao enable row level security;
alter table public.pendencias_revisadas enable row level security;

-- clientes: todos leem; editor cria (ao cadastrar proposta de cliente novo);
-- renomear e excluir (unificar) só admin.
create policy "clientes: ler" on public.clientes for select to authenticated using (public.pode_ler());
create policy "clientes: editor cria" on public.clientes for insert to authenticated with check (public.pode_editar());
create policy "clientes: admin altera" on public.clientes for update to authenticated using (public.e_admin()) with check (public.e_admin());
create policy "clientes: admin exclui" on public.clientes for delete to authenticated using (public.e_admin());

-- registros, acompanhamentos, notas: editor cria e edita; excluir só admin.
create policy "registros: ler" on public.registros for select to authenticated using (public.pode_ler());
create policy "registros: editor cria" on public.registros for insert to authenticated with check (public.pode_editar());
create policy "registros: editor altera" on public.registros for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy "registros: admin exclui" on public.registros for delete to authenticated using (public.e_admin());

create policy "acompanhamentos: ler" on public.acompanhamentos for select to authenticated using (public.pode_ler());
create policy "acompanhamentos: editor cria" on public.acompanhamentos for insert to authenticated with check (public.pode_editar());
create policy "acompanhamentos: editor altera" on public.acompanhamentos for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy "acompanhamentos: admin exclui" on public.acompanhamentos for delete to authenticated using (public.e_admin());

create policy "notas: ler" on public.notas_fiscais for select to authenticated using (public.pode_ler());
create policy "notas: editor cria" on public.notas_fiscais for insert to authenticated with check (public.pode_editar());
create policy "notas: editor altera" on public.notas_fiscais for update to authenticated using (public.pode_editar()) with check (public.pode_editar());
create policy "notas: admin exclui" on public.notas_fiscais for delete to authenticated using (public.e_admin());

-- taxonomia e configurações: todos leem; só admin escreve.
create policy "taxonomia: ler" on public.taxonomia for select to authenticated using (public.pode_ler());
create policy "taxonomia: admin escreve" on public.taxonomia for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy "configuracoes: ler" on public.configuracoes for select to authenticated using (public.pode_ler());
create policy "configuracoes: admin escreve" on public.configuracoes for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- histórico: só leitura (a escrita é feita pelo trigger, com security definer).
create policy "historico: ler" on public.historico_alteracoes for select to authenticated using (public.pode_ler());

create policy "avisos: ler" on public.avisos_importacao for select to authenticated using (public.pode_ler());

-- pendências: editor marca como revisada; desfazer só admin.
create policy "pendencias: ler" on public.pendencias_revisadas for select to authenticated using (public.pode_ler());
create policy "pendencias: editor revisa" on public.pendencias_revisadas for insert to authenticated
  with check (public.pode_editar() and revisado_por = auth.uid());
create policy "pendencias: admin desfaz" on public.pendencias_revisadas for delete to authenticated using (public.e_admin());

alter table public.pendencias_revisadas alter column revisado_por set default auth.uid();

-- Anônimos não têm acesso a nada. O histórico não aceita escrita direta de ninguém.
revoke all on table public.clientes, public.registros, public.acompanhamentos, public.notas_fiscais,
  public.taxonomia, public.configuracoes, public.historico_alteracoes, public.avisos_importacao,
  public.pendencias_revisadas from anon;
revoke insert, update, delete, truncate on table public.historico_alteracoes from authenticated;
revoke insert, update, delete, truncate on table public.avisos_importacao from authenticated;
revoke all on sequence public.registros_num_seq from anon;
