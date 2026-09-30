-- =====================================================================
-- Fase 2 — Importação da planilha e operações administrativas
-- =====================================================================

-- ---------------------------------------------------------------------
-- importar_planilha(dados): carrega data/cooesa_dados.json numa única
-- transação. Idempotente: rodar de novo não duplica nem sobrescreve nada
-- (on conflict do nothing em tudo — edições feitas no sistema são preservadas).
-- O histórico registra a origem como "importação da planilha".
-- Só a service_role executa (scripts/seed.ts).
-- ---------------------------------------------------------------------
create function public.importar_planilha(dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clientes int;
  v_registros int;
  v_acomp int;
  v_nv int;
  v_notas int;
  v_tax int;
  v_config int;
  v_avisos int;
begin
  perform set_config('app.origem', 'importação da planilha', true);

  -- clientes (nomes já em maiúsculas e unificados no JSON)
  insert into public.clientes (nome)
  select distinct btrim(x ->> 'empresa')
    from jsonb_array_elements(dados -> 'registros') x
  on conflict (nome) do nothing;
  get diagnostics v_clientes = row_count;

  -- registros, preservando o Nº original
  insert into public.registros (
    num, cliente_id, empresa_original, contato, gerente, escopo, situacao,
    data_ini, data_ini_texto, data_enc, data_enc_texto, tipo, valor, valor_texto,
    valor_vencedor, entidade, obs, ano, setor, area, empreendimento, servico, especialidade)
  select
    (x ->> 'num')::int,
    c.id,
    nullif(btrim(x ->> 'empresaOriginal'), ''),
    nullif(btrim(x ->> 'contato'), ''),
    nullif(btrim(x ->> 'gerente'), ''),
    nullif(btrim(x ->> 'escopo'), ''),
    nullif(btrim(x ->> 'situacao'), ''),
    (x ->> 'dataIni')::date,
    nullif(x ->> 'dataIniTexto', ''),
    (x ->> 'dataEnc')::date,
    nullif(x ->> 'dataEncTexto', ''),
    x ->> 'tipo',
    (x ->> 'valor')::numeric(14, 2),
    nullif(x ->> 'valorTexto', ''),
    (x ->> 'valorVencedor')::numeric(14, 2),
    nullif(x ->> 'entidade', ''),
    nullif(btrim(x ->> 'obs'), ''),
    (x ->> 'ano')::smallint,
    nullif(x ->> 'setor', ''),
    nullif(x ->> 'area', ''),
    nullif(x ->> 'empreendimento', ''),
    nullif(x ->> 'servico', ''),
    nullif(x ->> 'especialidade', '')
  from jsonb_array_elements(dados -> 'registros') x
  join public.clientes c on c.nome = btrim(x ->> 'empresa')
  order by (x ->> 'num')::int
  on conflict (num) do nothing;
  get diagnostics v_registros = row_count;

  -- acompanhamentos vinculados (abas 2001–2006)
  insert into public.acompanhamentos (registro_num, fonte, situacao_na_epoca, obs, a_receber, chave_importacao)
  select
    (x ->> 'num')::int,
    coalesce(nullif(a ->> 'fonte', ''), 'Planilha'),
    nullif(btrim(a ->> 'situacaoNaEpoca'), ''),
    nullif(btrim(a ->> 'obs'), ''),
    (a ->> 'aReceber')::numeric(14, 2),
    'planilha:registro:' || (x ->> 'num') || ':' || o
  from jsonb_array_elements(dados -> 'registros') x
  cross join lateral jsonb_array_elements(coalesce(x -> 'acompanhamentos', '[]'::jsonb)) with ordinality as t(a, o)
  on conflict (chave_importacao) do nothing;
  get diagnostics v_acomp = row_count;

  -- acompanhamentos não vinculados (registro_num nulo)
  insert into public.acompanhamentos (registro_num, fonte, situacao_na_epoca, obs, a_receber,
                                      empresa_texto, escopo_texto, chave_importacao)
  select
    null,
    coalesce(nullif(a ->> 'fonte', ''), 'Planilha'),
    nullif(btrim(a ->> 'situacaoNaEpoca'), ''),
    nullif(btrim(a ->> 'obs'), ''),
    (a ->> 'aReceber')::numeric(14, 2),
    coalesce(nullif(btrim(a ->> 'empresa'), ''), '(sem empresa)'),
    nullif(btrim(a ->> 'escopo'), ''),
    'planilha:nao-vinculado:' || o
  from jsonb_array_elements(coalesce(dados -> 'naoVinculados', '[]'::jsonb)) with ordinality as t(a, o)
  on conflict (chave_importacao) do nothing;
  get diagnostics v_nv = row_count;

  -- notas fiscais: cliente pelo nome exato; registro pelo registroNum
  insert into public.notas_fiscais (numero, data_emissao, data_credito, cliente_id, empresa_texto, titulo,
                                    valor, ano, registro_num, origem_aba, origem_linha)
  select
    nullif(n ->> 'numero', ''),
    (n ->> 'dataEmissao')::date,
    (n ->> 'dataCredito')::date,
    c.id,
    nullif(btrim(n ->> 'empresa'), ''),
    nullif(btrim(n ->> 'titulo'), ''),
    (n ->> 'valor')::numeric(14, 2),
    (n ->> 'ano')::smallint,
    (n ->> 'registroNum')::int,
    n ->> 'aba',
    (n ->> 'linha')::int
  from jsonb_array_elements(dados -> 'notas') n
  left join public.clientes c on c.nome = nullif(btrim(n ->> 'empresa'), '')
  on conflict (origem_aba, origem_linha) do nothing;
  get diagnostics v_notas = row_count;

  -- taxonomia (setores sem áreas entram com area nula)
  insert into public.taxonomia (setor, area, empreendimentos, servicos, especialidades, ordem)
  select s ->> 'setor', null, null, null, null, so * 100
    from jsonb_array_elements(dados -> 'taxonomia') with ordinality as t(s, so)
   where jsonb_array_length(coalesce(s -> 'areas', '[]'::jsonb)) = 0
  union all
  select s ->> 'setor', a ->> 'area', nullif(a ->> 'empreendimentos', ''), nullif(a ->> 'servicos', ''),
         nullif(a ->> 'especialidades', ''), so * 100 + ao
    from jsonb_array_elements(dados -> 'taxonomia') with ordinality as t(s, so)
   cross join lateral jsonb_array_elements(coalesce(s -> 'areas', '[]'::jsonb)) with ordinality as u(a, ao)
  on conflict (setor, area) do nothing;
  get diagnostics v_tax = row_count;

  -- alíquotas estimadas de tributos (% sobre o valor da nota), editáveis em Configurações
  insert into public.configuracoes (chave, valor, descricao) values
    ('aliquota_irpj',   '4.0219', 'IRPJ estimado (% sobre o valor da nota)'),
    ('aliquota_csll',   '2.5137', 'CSLL estimada (% sobre o valor da nota)'),
    ('aliquota_cofins', '2.5003', 'COFINS estimada (% sobre o valor da nota)'),
    ('aliquota_pis',    '0.5413', 'PIS estimado (% sobre o valor da nota)'),
    ('aliquota_inss',   '3.9968', 'INSS estimado (% sobre o valor da nota)'),
    ('aliquota_iss',    '3.1840', 'ISS estimado (% sobre o valor da nota)')
  on conflict (chave) do nothing;
  get diagnostics v_config = row_count;

  -- avisos para revisão humana
  insert into public.avisos_importacao (tipo, chave, referencia, descricao)
  select 'cliente_unificado', r.num::text, 'Registro Nº ' || r.num,
         'Cliente grafado “' || r.empresa_original || '” na planilha foi unificado para “' || c.nome ||
         '” na extração. Confirme que é o mesmo cliente.'
    from public.registros r
    join public.clientes c on c.id = r.cliente_id
   where r.empresa_original is not null and r.num <= 1059
  on conflict (tipo, chave) do nothing;

  insert into public.avisos_importacao (tipo, chave, referencia, descricao) values
    ('faturamento_divergente', '2020-10', 'Faturamento de outubro/2020',
     'O total mensal digitado na planilha deixou de fora três notas (R$ 47.300,00). O sistema soma todas as notas; confira e marque como revisado.'),
    ('faturamento_divergente', '2024-07', 'Faturamento de julho/2024',
     'O total mensal digitado na planilha somou só a primeira de três notas (R$ 6.000,00 em vez de R$ 20.000,00). O sistema soma todas as notas; confira e marque como revisado.')
  on conflict (tipo, chave) do nothing;
  get diagnostics v_avisos = row_count;

  -- novos registros continuam a numeração da planilha (1060 em diante)
  perform setval('public.registros_num_seq',
                 greatest(coalesce((select max(num) from public.registros), 0), 1059), true);

  return jsonb_build_object(
    'clientes', v_clientes, 'registros', v_registros, 'acompanhamentos', v_acomp,
    'acompanhamentos_nao_vinculados', v_nv, 'notas', v_notas, 'taxonomia', v_tax,
    'configuracoes', v_config);
end;
$$;

revoke execute on function public.importar_planilha(jsonb) from public, anon, authenticated;
grant execute on function public.importar_planilha(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- unificar_clientes(origem, destino): todos os registros e notas do cliente
-- de origem passam para o destino; o nome antigo fica em empresa_original
-- dos registros afetados (se ainda não houver grafia original) e no
-- histórico (exclusão do cliente de origem). Só admin.
-- Roda com os privilégios de quem chama (RLS vale).
-- ---------------------------------------------------------------------
create function public.unificar_clientes(p_origem bigint, p_destino bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_nome_origem text;
  v_nome_destino text;
  v_registros int;
  v_notas int;
begin
  if not public.e_admin() then
    raise exception 'Apenas administradores podem unificar clientes.' using errcode = '42501';
  end if;
  if p_origem = p_destino then
    raise exception 'Escolha dois clientes diferentes.' using errcode = '22023';
  end if;

  select nome into v_nome_origem from public.clientes where id = p_origem for update;
  select nome into v_nome_destino from public.clientes where id = p_destino for update;
  if v_nome_origem is null or v_nome_destino is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  update public.registros
     set cliente_id = p_destino,
         empresa_original = coalesce(empresa_original, v_nome_origem)
   where cliente_id = p_origem;
  get diagnostics v_registros = row_count;

  update public.notas_fiscais
     set cliente_id = p_destino,
         empresa_texto = coalesce(empresa_texto, v_nome_origem)
   where cliente_id = p_origem;
  get diagnostics v_notas = row_count;

  delete from public.clientes where id = p_origem;

  return jsonb_build_object('origem', v_nome_origem, 'destino', v_nome_destino,
                            'registros', v_registros, 'notas', v_notas);
end;
$$;

revoke execute on function public.unificar_clientes(bigint, bigint) from public, anon;
grant execute on function public.unificar_clientes(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- keep_alive(): consulta levíssima usada por /api/keep-alive para o
-- projeto gratuito não ser pausado por inatividade.
-- ---------------------------------------------------------------------
create function public.keep_alive()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select now() where exists (select 1 from public.configuracoes limit 1) or true
$$;

revoke execute on function public.keep_alive() from public, anon, authenticated;
grant execute on function public.keep_alive() to service_role;
