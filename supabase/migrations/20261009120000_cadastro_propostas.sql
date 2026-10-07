-- =====================================================================
-- Cadastro de propostas: dados técnicos e comerciais de engenharia.
--
-- Todos os campos novos são opcionais: os 1.059 registros da planilha
-- continuam válidos e nada é inventado para eles. Valores calculados
-- (contratado, sucesso) não mudam: continuam vindo de valor/tipo/situacao.
-- =====================================================================

alter table public.registros
  -- Objeto técnico
  add column descricao          text,
  add column obra               text,
  add column local_municipio    text,
  add column local_uf           char(2),
  add column cliente_final      text,
  add column potencia_mw        numeric(10, 2),
  add column tensao_kv          numeric(8, 2),
  add column extensao_km        numeric(10, 2),
  -- Comercial
  add column modalidade         text,
  add column edital             text,
  add column revisao            smallint not null default 0,
  add column validade_dias      smallint,
  add column prazo_meses        numeric(5, 1),
  add column horas_estimadas    integer,
  add column responsavel_tecnico text,
  add column concorrentes       text,
  -- Situação
  add column motivo_perda       text,
  -- Envio idempotente: a mesma submissão (clique duplo, rede lenta) nunca cria dois registros.
  add column chave_envio        text,
  add constraint registros_local_uf_valida check (
    local_uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
  ),
  add constraint registros_modalidade_valida check (
    modalidade in ('Contratação direta', 'Licitação pública', 'Concorrência privada', 'Aditivo de contrato')
  ),
  add constraint registros_motivo_perda_valido check (
    motivo_perda in ('Preço', 'Prazo', 'Qualificação técnica', 'Escopo alterado', 'Cancelado pelo cliente', 'Sem retorno do cliente', 'Outro')
  ),
  add constraint registros_tecnicos_positivos check (
    coalesce(potencia_mw, 0) >= 0 and coalesce(tensao_kv, 0) >= 0 and coalesce(extensao_km, 0) >= 0
    and coalesce(prazo_meses, 0) >= 0 and coalesce(horas_estimadas, 0) >= 0 and coalesce(validade_dias, 0) >= 0
  ),
  add constraint registros_revisao_valida check (revisao between 0 and 99);

comment on column public.registros.cliente_final is 'Cliente final quando a proposta é feita por intermediário (ex.: GE / THREE AR).';
comment on column public.registros.revisao is 'Revisão da proposta (0 = R0).';
comment on column public.registros.motivo_perda is 'Por que a proposta foi perdida ou cancelada (para análise em Resultados).';
comment on column public.registros.chave_envio is 'Identificador da submissão do formulário (idempotência). Não editar.';

create unique index registros_chave_envio_unica on public.registros (chave_envio) where chave_envio is not null;

-- A chave de envio não é uma alteração de conteúdo: fica fora do histórico.
create or replace function public.colunas_ignoradas_auditoria()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['busca', 'atualizado_em', 'atualizado_por', 'chave_envio']
$$;

-- Busca passa a achar também pela obra, cliente final, município e edital.
create or replace function public.preparar_registro()
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
    new.setor, new.area, new.empreendimento, new.servico, new.especialidade, new.valor_texto,
    new.obra, new.cliente_final, new.local_municipio, new.edital));
  return new;
end;
$$;
