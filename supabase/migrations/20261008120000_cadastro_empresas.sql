-- =====================================================================
-- Cadastro de empresas (docs/prompts/cadastro-de-empresas.md)
--
-- A tabela clientes continua sendo o cadastro de empresas (propostas e
-- notas já apontam para ela). Ganha dados cadastrais, status de
-- relacionamento e uma tabela de contatos. Valores NÃO são digitados:
-- continuam calculados das propostas e notas, na vw_clientes.
-- Empresas existentes ficam com os campos novos vazios; o status
-- sugerido só é gravado quando um admin confirma (aplicar_status_sugerido).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CNPJ: 14 dígitos, com os dois dígitos verificadores conferidos.
-- ---------------------------------------------------------------------
create function public.cnpj_valido(cnpj text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  d int[];
  soma int;
  resto int;
  pesos1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  pesos2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
begin
  if cnpj !~ '^[0-9]{14}$' or cnpj ~ '^([0-9])\1{13}$' then
    return false;  -- formato errado ou todos os dígitos iguais
  end if;
  d := array(select substr(cnpj, i, 1)::int from generate_series(1, 14) as i);
  soma := 0;
  for i in 1..12 loop soma := soma + d[i] * pesos1[i]; end loop;
  resto := soma % 11;
  if (case when resto < 2 then 0 else 11 - resto end) <> d[13] then
    return false;
  end if;
  soma := 0;
  for i in 1..13 loop soma := soma + d[i] * pesos2[i]; end loop;
  resto := soma % 11;
  return (case when resto < 2 then 0 else 11 - resto end) = d[14];
end;
$$;

-- ---------------------------------------------------------------------
-- Novos campos da empresa
-- ---------------------------------------------------------------------
alter table public.clientes
  add column status         text,
  add column razao_social   text,
  add column cnpj           text,
  add column setor          text,
  add column cidade         text,
  add column uf             char(2),
  add column site           text,
  add column responsavel    text,
  add column origem         text,
  add column observacoes    text,
  add column atualizado_em  timestamptz,
  add column atualizado_por uuid references auth.users (id) on delete set null,
  add constraint clientes_status_valido check (
    status in ('Prospecção', 'Proposta em andamento', 'Cliente ativo', 'Cliente inativo', 'Não atender')
  ),
  add constraint clientes_uf_valida check (
    uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
           'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
  ),
  add constraint clientes_cnpj_valido check (cnpj is null or public.cnpj_valido(cnpj));

comment on column public.clientes.nome is 'Nome curto usado no sistema (ex.: CPFL), único e em maiúsculas. Só admin renomeia.';
comment on column public.clientes.status is 'Status do relacionamento. Nulo = legado ainda não classificado.';
comment on column public.clientes.cnpj is 'Só os 14 dígitos, com dígitos verificadores válidos. Único quando preenchido.';

create unique index clientes_cnpj_unico on public.clientes (cnpj) where cnpj is not null;
create index clientes_status_idx on public.clientes (status);

create trigger clientes_c_carimbo_atualizacao before insert or update on public.clientes
  for each row execute function public.carimbar_atualizacao();

-- O editor passa a editar o cadastro, mas renomear continua só com o admin
-- (o nome é usado na carga da planilha, na busca e na unificação).
create function public.clientes_proteger_nome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.nome is distinct from old.nome and auth.role() = 'authenticated' and not public.e_admin() then
    raise exception 'Só administradores podem renomear empresas.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clientes_a_proteger_nome before update of nome on public.clientes
  for each row execute function public.clientes_proteger_nome();

drop policy "clientes: admin altera" on public.clientes;
create policy "clientes: editor altera" on public.clientes for update to authenticated
  using (public.pode_editar()) with check (public.pode_editar());

-- ---------------------------------------------------------------------
-- Contatos da empresa — DADOS PESSOAIS (LGPD): só no detalhe da empresa.
-- ---------------------------------------------------------------------
create table public.contatos_empresa (
  id             bigint generated always as identity primary key,
  cliente_id     bigint not null references public.clientes (id) on delete cascade,
  nome           text not null,
  cargo          text,
  email          text,
  telefone       text,
  principal      boolean not null default false,
  observacoes    text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references auth.users (id) on delete set null,
  atualizado_em  timestamptz,
  atualizado_por uuid references auth.users (id) on delete set null,
  constraint contatos_nome_preenchido check (btrim(nome) <> ''),
  constraint contatos_email_valido check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
comment on table public.contatos_empresa is 'Contatos das empresas. Dados pessoais (LGPD): fora de listas gerais, exportações e URLs.';

create index contatos_cliente_idx on public.contatos_empresa (cliente_id);
create unique index contatos_um_principal on public.contatos_empresa (cliente_id) where principal;

create trigger contatos_b_carimbo_criacao before insert or update on public.contatos_empresa
  for each row execute function public.carimbar_criacao();
create trigger contatos_c_carimbo_atualizacao before insert or update on public.contatos_empresa
  for each row execute function public.carimbar_atualizacao();
create trigger contatos_historico after insert or update or delete on public.contatos_empresa
  for each row execute function public.registrar_historico('id');

alter table public.contatos_empresa enable row level security;
create policy "contatos: ler" on public.contatos_empresa for select to authenticated using (public.pode_ler());
create policy "contatos: editor cria" on public.contatos_empresa for insert to authenticated with check (public.pode_editar());
create policy "contatos: editor altera" on public.contatos_empresa for update to authenticated
  using (public.pode_editar()) with check (public.pode_editar());
-- Remover um contato é parte de manter o cadastro em dia (fica no histórico).
create policy "contatos: editor remove" on public.contatos_empresa for delete to authenticated using (public.pode_editar());
revoke all on table public.contatos_empresa from anon;

-- ---------------------------------------------------------------------
-- Status sugerido (regra aprovada em 08/10/2026), aplicada nesta ordem:
--   contrato em andamento → Cliente ativo
--   proposta aguardando resposta → Proposta em andamento
--   contrato nos últimos 3 anos → Cliente ativo
--   contrato mais antigo → Cliente inativo
--   nunca contratou → Prospecção
-- ---------------------------------------------------------------------
create function public.status_sugerido_cliente(p_cliente bigint)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when bool_or(r.situacao = 'Contrato em andamento') then 'Cliente ativo'
    when bool_or(r.situacao = 'Proposta colocada') then 'Proposta em andamento'
    when max(r.ano) filter (where public.e_contrato_total(r.situacao)) >= extract(year from current_date)::int - 3
      then 'Cliente ativo'
    when bool_or(public.e_contrato_total(r.situacao)) then 'Cliente inativo'
    else 'Prospecção'
  end
  from public.registros r
  where r.cliente_id = p_cliente
$$;

-- Grava o status sugerido nas empresas ainda sem status (só admin).
-- Nunca sobrescreve um status já escolhido por alguém.
create function public.aplicar_status_sugerido()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not public.e_admin() then
    raise exception 'Só administradores podem aplicar as sugestões de status.' using errcode = '42501';
  end if;
  with alteradas as (
    update public.clientes c
       set status = public.status_sugerido_cliente(c.id)
     where c.status is null
    returning c.status
  )
  select coalesce(jsonb_object_agg(status, quantidade), '{}'::jsonb)
    into v_resultado
    from (select status, count(*)::int as quantidade from alteradas group by status) t;
  return v_resultado;
end;
$$;

revoke execute on function public.aplicar_status_sugerido() from public, anon;
grant execute on function public.aplicar_status_sugerido() to authenticated;

-- ---------------------------------------------------------------------
-- Unificação: leva os contatos e completa os campos vazios do destino
-- com os da origem, sem sobrescrever o que o destino já tem.
-- ---------------------------------------------------------------------
create or replace function public.unificar_clientes(p_origem bigint, p_destino bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  o public.clientes%rowtype;
  d public.clientes%rowtype;
  v_registros int;
  v_notas int;
  v_contatos int;
begin
  if not public.e_admin() then
    raise exception 'Apenas administradores podem unificar clientes.' using errcode = '42501';
  end if;
  if p_origem = p_destino then
    raise exception 'Escolha dois clientes diferentes.' using errcode = '22023';
  end if;

  select * into o from public.clientes where id = p_origem for update;
  select * into d from public.clientes where id = p_destino for update;
  if o.id is null or d.id is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  update public.registros
     set cliente_id = p_destino,
         empresa_original = coalesce(empresa_original, o.nome)
   where cliente_id = p_origem;
  get diagnostics v_registros = row_count;

  update public.notas_fiscais
     set cliente_id = p_destino,
         empresa_texto = coalesce(empresa_texto, o.nome)
   where cliente_id = p_origem;
  get diagnostics v_notas = row_count;

  -- Contatos: se o destino já tem principal, os da origem chegam como não principais.
  update public.contatos_empresa
     set cliente_id = p_destino,
         principal = principal and not exists (
           select 1 from public.contatos_empresa x where x.cliente_id = p_destino and x.principal)
   where cliente_id = p_origem;
  get diagnostics v_contatos = row_count;

  -- O CNPJ é único: sai da origem antes de ir para o destino.
  if d.cnpj is null and o.cnpj is not null then
    update public.clientes set cnpj = null where id = p_origem;
  end if;

  update public.clientes
     set status       = coalesce(d.status, o.status),
         razao_social = coalesce(d.razao_social, o.razao_social),
         cnpj         = coalesce(d.cnpj, o.cnpj),
         setor        = coalesce(d.setor, o.setor),
         cidade       = coalesce(d.cidade, o.cidade),
         uf           = coalesce(d.uf, o.uf),
         site         = coalesce(d.site, o.site),
         responsavel  = coalesce(d.responsavel, o.responsavel),
         origem       = coalesce(d.origem, o.origem),
         observacoes  = coalesce(d.observacoes, o.observacoes)
   where id = p_destino;

  delete from public.clientes where id = p_origem;

  return jsonb_build_object('origem', o.nome, 'destino', d.nome,
                            'registros', v_registros, 'notas', v_notas, 'contatos', v_contatos);
end;
$$;

-- ---------------------------------------------------------------------
-- vw_clientes com o cadastro novo (colunas novas no fim, para o
-- "create or replace" manter as existentes).
-- ---------------------------------------------------------------------
create or replace view public.vw_clientes with (security_invoker = true) as
select
  c.id,
  c.nome,
  coalesce(r.propostas, 0)          as propostas,
  coalesce(r.contratos, 0)          as contratos,
  round(100.0 * coalesce(r.contratos, 0) / nullif(r.propostas, 0), 2) as pct_sucesso,
  coalesce(r.valor_contratado_p, 0) as valor_contratado_p,
  coalesce(r.valor_contratado_t, 0) as valor_contratado_t,
  coalesce(n.faturado, 0)           as faturado,
  coalesce(n.notas, 0)              as notas,
  r.primeiro_ano,
  r.ultimo_ano,
  public.normalizar_busca(concat_ws(' ', c.nome, c.razao_social, c.cnpj, c.cidade)) as busca,
  c.status,
  public.status_sugerido_cliente(c.id) as status_sugerido,
  c.razao_social,
  c.cnpj,
  c.setor,
  c.cidade,
  c.uf,
  c.site,
  c.responsavel,
  c.origem,
  c.observacoes,
  r.ultima_proposta,
  coalesce(r.valor_proposto_p, 0)   as valor_proposto_p,
  c.criado_em,
  c.atualizado_em
from public.clientes c
left join lateral (
  select
    count(*)::int as propostas,
    count(*) filter (where public.e_contrato_total(x.situacao))::int as contratos,
    sum(x.valor) filter (where public.e_contrato_total(x.situacao) and x.tipo = 'P') as valor_contratado_p,
    sum(x.valor) filter (where public.e_contrato_total(x.situacao) and x.tipo = 'T') as valor_contratado_t,
    sum(x.valor) filter (where x.tipo = 'P') as valor_proposto_p,
    min(x.ano)::int as primeiro_ano,
    max(x.ano)::int as ultimo_ano,
    max(coalesce(x.data_ini, make_date(x.ano, 1, 1))) as ultima_proposta
  from public.registros x
  where x.cliente_id = c.id
) r on true
left join lateral (
  select sum(y.valor) as faturado, count(*)::int as notas
  from public.notas_fiscais y
  where y.cliente_id = c.id
) n on true;

revoke all on public.vw_clientes from anon;
