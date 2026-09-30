-- =====================================================================
-- Fase 2 — Views. As contas moram no banco; a interface só exibe.
-- Todas com security_invoker: o RLS das tabelas vale para quem consulta.
-- =====================================================================

-- Moeda no padrão brasileiro (R$ 1.234,56), independente do locale do servidor.
create function public.formatar_moeda(valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(valor, 'FM999,999,999,990.00'), ',.', '.,')
$$;

-- ---------------------------------------------------------------------
-- Lista de registros (tela Propostas e contratos). Sem o contato (LGPD):
-- o contato só aparece no detalhe do registro.
-- ---------------------------------------------------------------------
create view public.vw_registros with (security_invoker = true) as
select
  r.num,
  r.cliente_id,
  c.nome                       as cliente,
  r.empresa_original,
  r.gerente,
  r.escopo,
  r.situacao,
  public.grupo_situacao(r.situacao) as grupo,
  public.e_contrato_total(r.situacao) as contrato_total,
  r.data_ini,
  r.data_ini_texto,
  r.data_enc,
  r.data_enc_texto,
  r.tipo,
  r.valor,
  r.valor_texto,
  r.valor_vencedor,
  r.entidade,
  r.obs,
  r.ano,
  r.setor,
  r.area,
  r.empreendimento,
  r.servico,
  r.especialidade,
  r.busca,
  coalesce(r.atualizado_em, r.criado_em) as modificado_em
from public.registros r
join public.clientes c on c.id = r.cliente_id;

-- ---------------------------------------------------------------------
-- Resumo geral (mesmas colunas da aba RESUMO, e alguns extras)
-- ---------------------------------------------------------------------
create view public.vw_resumo with (security_invoker = true) as
select
  count(*)::int                                                         as total_propostas,
  count(*) filter (where situacao = 'Contrato encerrado')::int          as encerrados,
  count(*) filter (where situacao = 'Contrato em andamento')::int       as em_andamento,
  count(*) filter (where public.e_contrato_total(situacao))::int        as contratos_totais,
  round(100.0 * count(*) filter (where public.e_contrato_total(situacao)) / nullif(count(*), 0), 2)
                                                                        as pct_sucesso,
  count(distinct cliente_id)::int                                       as clientes_distintos,
  count(distinct cliente_id) filter (where public.e_contrato_total(situacao))::int
                                                                        as clientes_contrataram,
  count(*) filter (where situacao = 'Proposta colocada')::int           as aguardando,
  count(*) filter (where situacao = 'Proposta colocada - negativa')::int as perdidas,
  count(*) filter (where situacao = 'Proposta cancelada')::int          as canceladas,
  count(*) filter (where public.grupo_situacao(situacao) = 'litigio')::int as em_litigio,
  count(*) filter (where situacao is null)::int                         as sem_situacao,
  count(*) filter (where tipo = 'P')::int                               as tipo_p,
  count(*) filter (where tipo = 'T')::int                               as tipo_t,
  coalesce(sum(valor), 0)                                               as valor_total_registros,
  coalesce(sum(valor) filter (where public.e_contrato_total(situacao) and tipo = 'P'), 0) as valor_contratado_p,
  coalesce(sum(valor) filter (where public.e_contrato_total(situacao) and tipo = 'T'), 0) as valor_contratado_t_mensal,
  min(ano)::int                                                         as primeiro_ano,
  max(ano)::int                                                         as ultimo_ano
from public.registros;

-- ---------------------------------------------------------------------
-- Resumo por ano, de 2000 até o ano atual (anos sem registro aparecem com zero)
-- ---------------------------------------------------------------------
create view public.vw_resumo_anual with (security_invoker = true) as
with anos as (
  select generate_series(
    least(2000, coalesce((select min(ano) from public.registros), 2000)),
    greatest(extract(year from current_date)::int, coalesce((select max(ano) from public.registros), 2000))
  )::int as ano
),
agregado as (
  select
    ano,
    count(*)::int                                                      as propostas,
    count(*) filter (where public.e_contrato_total(situacao))::int     as contratos,
    count(*) filter (where situacao = 'Proposta colocada')::int        as aguardando,
    count(*) filter (where situacao = 'Proposta colocada - negativa')::int as perdidas,
    coalesce(sum(valor) filter (where tipo = 'P'), 0)                  as valor_proposto_p,
    coalesce(sum(valor) filter (where tipo = 'T'), 0)                  as valor_proposto_t,
    coalesce(sum(valor) filter (where tipo = 'P' and public.e_contrato_total(situacao)), 0) as valor_contratado_p,
    coalesce(sum(valor) filter (where tipo = 'T' and public.e_contrato_total(situacao)), 0) as valor_contratado_t
  from public.registros
  group by ano
)
select
  a.ano,
  coalesce(g.propostas, 0)   as propostas,
  coalesce(g.contratos, 0)   as contratos,
  round(100.0 * coalesce(g.contratos, 0) / nullif(g.propostas, 0), 2) as pct_sucesso,
  coalesce(g.aguardando, 0)  as aguardando,
  coalesce(g.perdidas, 0)    as perdidas,
  coalesce(g.valor_proposto_p, 0)   as valor_proposto_p,
  coalesce(g.valor_proposto_t, 0)   as valor_proposto_t,
  coalesce(g.valor_contratado_p, 0) as valor_contratado_p,
  coalesce(g.valor_contratado_t, 0) as valor_contratado_t
from anos a
left join agregado g on g.ano = a.ano
order by a.ano;

-- ---------------------------------------------------------------------
-- Alíquotas vigentes (em %), lidas de configuracoes
-- ---------------------------------------------------------------------
create view public.vw_aliquotas with (security_invoker = true) as
select
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_irpj'), 0)   as irpj,
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_csll'), 0)   as csll,
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_cofins'), 0) as cofins,
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_pis'), 0)    as pis,
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_inss'), 0)   as inss,
  coalesce((select (valor #>> '{}')::numeric from public.configuracoes where chave = 'aliquota_iss'), 0)    as iss;

-- ---------------------------------------------------------------------
-- Faturamento por ano/mês, a partir das notas (nunca de totais digitados).
-- Notas sem data de emissão entram no ano da aba de origem, com mes nulo.
-- ---------------------------------------------------------------------
create view public.vw_faturamento_mensal with (security_invoker = true) as
select
  n.ano::int                                        as ano,
  extract(month from n.data_emissao)::int           as mes,
  count(*)::int                                     as quantidade,
  sum(n.valor)                                      as total,
  count(*) filter (where n.data_credito is null)::int as a_receber_quantidade,
  coalesce(sum(n.valor) filter (where n.data_credito is null), 0) as a_receber_valor,
  round(sum(n.valor) * a.irpj / 100, 2)             as irpj,
  round(sum(n.valor) * a.csll / 100, 2)             as csll,
  round(sum(n.valor) * a.cofins / 100, 2)           as cofins,
  round(sum(n.valor) * a.pis / 100, 2)              as pis,
  round(sum(n.valor) * a.inss / 100, 2)             as inss,
  round(sum(n.valor) * a.iss / 100, 2)              as iss,
  round(sum(n.valor) * (a.irpj + a.csll + a.cofins + a.pis + a.inss + a.iss) / 100, 2) as tributos_total
from public.notas_fiscais n
cross join public.vw_aliquotas a
group by n.ano, extract(month from n.data_emissao), a.irpj, a.csll, a.cofins, a.pis, a.inss, a.iss;

-- Totais por ano (comparativo anual)
create view public.vw_faturamento_anual with (security_invoker = true) as
select
  ano,
  sum(quantidade)::int  as quantidade,
  sum(total)            as total,
  sum(tributos_total)   as tributos_total,
  sum(a_receber_quantidade)::int as a_receber_quantidade,
  sum(a_receber_valor)  as a_receber_valor
from public.vw_faturamento_mensal
group by ano;

-- Notas com nome do cliente (tela Faturamento)
create view public.vw_notas with (security_invoker = true) as
select
  n.*,
  c.nome as cliente,
  coalesce(c.nome, n.empresa_texto) as cliente_exibicao,
  (n.data_credito is null) as a_receber
from public.notas_fiscais n
left join public.clientes c on c.id = n.cliente_id;

-- ---------------------------------------------------------------------
-- Clientes com indicadores (aba Nº Clientes)
-- ---------------------------------------------------------------------
create view public.vw_clientes with (security_invoker = true) as
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
  public.normalizar_busca(c.nome)   as busca
from public.clientes c
left join lateral (
  select
    count(*)::int as propostas,
    count(*) filter (where public.e_contrato_total(x.situacao))::int as contratos,
    sum(x.valor) filter (where public.e_contrato_total(x.situacao) and x.tipo = 'P') as valor_contratado_p,
    sum(x.valor) filter (where public.e_contrato_total(x.situacao) and x.tipo = 'T') as valor_contratado_t,
    min(x.ano)::int as primeiro_ano,
    max(x.ano)::int as ultimo_ano
  from public.registros x
  where x.cliente_id = c.id
) r on true
left join lateral (
  select sum(y.valor) as faturado, count(*)::int as notas
  from public.notas_fiscais y
  where y.cliente_id = c.id
) n on true;

-- ---------------------------------------------------------------------
-- Currículo: só contratos (encerrado + em andamento), com a classificação
-- completa (níveis A–E) para os filtros encadeados.
-- ---------------------------------------------------------------------
create view public.vw_curriculo with (security_invoker = true) as
select
  r.num,
  c.nome as cliente,
  r.escopo,
  r.ano,
  r.data_ini,
  r.data_enc,
  r.situacao,
  r.setor,
  r.area,
  r.empreendimento,
  r.servico,
  r.especialidade,
  r.tipo,
  r.valor,
  r.gerente,
  r.busca
from public.registros r
join public.clientes c on c.id = r.cliente_id
where public.e_contrato_total(r.situacao);

-- ---------------------------------------------------------------------
-- Pendências de dados (seção 4.5). Cada linha tem tipo, chave e link para
-- corrigir. Some quando o dado é corrigido ou quando alguém marca como revisada.
-- ---------------------------------------------------------------------
create view public.vw_pendencias with (security_invoker = true) as
with brutas as (
  -- Data de início digitada de forma ilegível: some quando a data for preenchida.
  select 'data_inicio'::text as tipo, r.num::text as chave, 'Registro Nº ' || r.num as referencia,
         'Data de início digitada como “' || r.data_ini_texto || '” na planilha. Informe a data correta.' as descricao,
         '/registros/' || r.num || '/editar' as link, r.num as registro_num
    from public.registros r
   where r.data_ini_texto is not null and r.data_ini is null
  union all
  -- Data de encerramento no formato mês/ano (dia 1º inferido): confirmar.
  select 'data_encerramento', r.num::text, 'Registro Nº ' || r.num,
         'Encerramento digitado como “' || r.data_enc_texto || '”; o sistema assumiu ' ||
         to_char(r.data_enc, 'DD/MM/YYYY') || '. Confirme ou corrija a data.',
         '/registros/' || r.num || '/editar', r.num
    from public.registros r
   where r.data_enc_texto is not null
  union all
  -- Valor em texto: some quando o valor numérico for preenchido.
  select 'valor_texto', r.num::text, 'Registro Nº ' || r.num,
         'Valor registrado como texto: “' || r.valor_texto || '”. Informe o valor numérico ou marque como revisado se não houver valor.',
         '/registros/' || r.num || '/editar', r.num
    from public.registros r
   where r.valor_texto is not null and r.valor is null
  union all
  select 'sem_situacao', r.num::text, 'Registro Nº ' || r.num,
         'Registro sem situação na planilha. Defina a situação.',
         '/registros/' || r.num || '/editar', r.num
    from public.registros r
   where r.situacao is null
  union all
  select 'sem_escopo', r.num::text, 'Registro Nº ' || r.num,
         'Registro sem escopo na planilha. Descreva o serviço.',
         '/registros/' || r.num || '/editar', r.num
    from public.registros r
   where nullif(btrim(r.escopo), '') is null
  union all
  -- Possíveis clientes duplicados: um nome é prefixo do outro.
  select 'cliente_duplicado', a.id || '-' || b.id, a.nome || ' × ' || b.nome,
         'Os nomes “' || a.nome || '” e “' || b.nome || '” podem ser o mesmo cliente. Unifique ou marque como clientes diferentes.',
         '/clientes/' || b.id || '?unificar=' || a.id, null::integer
    from public.clientes a
    join public.clientes b on b.id <> a.id and length(a.nome) >= 2 and b.nome like a.nome || '%'
  union all
  select 'acompanhamento_nao_vinculado', ac.id::text, coalesce(ac.fonte, 'Acompanhamento') || ' · ' || coalesce(ac.empresa_texto, ''),
         'Anotação antiga sem registro correspondente: “' || coalesce(ac.escopo_texto, '') || '”. Vincule a um registro ou marque como revisada.',
         '/pendencias/acompanhamento/' || ac.id, null
    from public.acompanhamentos ac
   where ac.registro_num is null
  union all
  select 'nota_incompleta', n.id::text, 'NF ' || coalesce(nullif(n.numero, ''), 's/nº') || ' · ' || n.origem_aba || ', linha ' || n.origem_linha,
         'Nota de ' || public.formatar_moeda(n.valor) || ' sem ' ||
         concat_ws(' e ',
           case when n.cliente_id is null and n.empresa_texto is null then 'cliente' end,
           case when n.data_emissao is null then 'data de emissão' end) || ' na planilha.',
         '/faturamento/notas/' || n.id || '/editar', n.registro_num
    from public.notas_fiscais n
   where (n.cliente_id is null and n.empresa_texto is null) or n.data_emissao is null
  union all
  select 'nota_cliente_nao_cadastrado', n.id::text, 'NF ' || coalesce(nullif(n.numero, ''), 's/nº'),
         'Empresa “' || n.empresa_texto || '” não corresponde a nenhum cliente cadastrado. Vincule a um cliente.',
         '/faturamento/notas/' || n.id || '/editar', n.registro_num
    from public.notas_fiscais n
   where n.cliente_id is null and n.empresa_texto is not null
  union all
  select av.tipo, av.chave, av.referencia, av.descricao,
         case av.tipo
           when 'cliente_unificado' then '/registros/' || av.chave
           when 'faturamento_divergente' then '/faturamento?ano=' || split_part(av.chave, '-', 1)
         end,
         case when av.tipo = 'cliente_unificado' then av.chave::integer end
    from public.avisos_importacao av
)
select b.*
from brutas b
where not exists (
  select 1 from public.pendencias_revisadas pr where pr.tipo = b.tipo and pr.chave = b.chave
);

-- Valores já usados em cada nível da classificação (autocompletar).
create view public.vw_valores_classificacao with (security_invoker = true) as
select 'setor' as nivel, setor as valor, count(*)::int as usos from public.registros where setor is not null group by setor
union all
select 'area', area, count(*)::int from public.registros where area is not null group by area
union all
select 'empreendimento', empreendimento, count(*)::int from public.registros where empreendimento is not null group by empreendimento
union all
select 'servico', servico, count(*)::int from public.registros where servico is not null group by servico
union all
select 'especialidade', especialidade, count(*)::int from public.registros where especialidade is not null group by especialidade
union all
select 'gerente', gerente, count(*)::int from public.registros where gerente is not null group by gerente;

revoke all on public.vw_registros, public.vw_resumo, public.vw_resumo_anual, public.vw_aliquotas,
  public.vw_faturamento_mensal, public.vw_faturamento_anual, public.vw_notas, public.vw_clientes,
  public.vw_curriculo, public.vw_pendencias, public.vw_valores_classificacao from anon;

-- Quantidade de registros por situação (conferência da carga e painel).
create view public.vw_contagem_situacoes with (security_invoker = true) as
select situacao, public.grupo_situacao(situacao) as grupo, count(*)::int as quantidade
from public.registros
group by situacao;

-- Conferência de acompanhamentos (vinculados × não vinculados).
create view public.vw_contagem_acompanhamentos with (security_invoker = true) as
select
  count(*) filter (where registro_num is not null)::int as vinculados,
  count(*) filter (where registro_num is null)::int     as nao_vinculados
from public.acompanhamentos;

revoke all on public.vw_contagem_situacoes, public.vw_contagem_acompanhamentos from anon;
