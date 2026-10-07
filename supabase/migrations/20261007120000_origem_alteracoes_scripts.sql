-- =====================================================================
-- Origem legível para alterações feitas por scripts (service_role).
--
-- Antes: o histórico registrava "sistema (postgres)" — sem dizer quem
-- autorizou nem por quê. Agora um script com a chave de serviço pode
-- enviar o cabeçalho HTTP  x-origem-alteracao: "<texto>"  e o histórico
-- grava esse texto como autor. O cabeçalho só vale para a service_role:
-- usuários comuns continuam identificados pelo login (não dá para forjar).
-- Linhas antigas do histórico não mudam (ele é imutável de propósito).
-- =====================================================================

create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes   jsonb;
  v_depois  jsonb;
  v_uid     uuid := auth.uid();
  v_papel   text := auth.role();
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

  -- Scripts com a chave de serviço: origem declarada no cabeçalho x-origem-alteracao.
  if v_origem is null and v_papel = 'service_role' then
    begin
      v_origem := left(nullif(btrim(
        nullif(current_setting('request.headers', true), '')::json ->> 'x-origem-alteracao'), ''), 200);
    exception when others then
      v_origem := null;  -- cabeçalhos ilegíveis não podem impedir a gravação
    end;
  end if;

  if v_origem is not null then
    v_usuario := v_origem;
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
    coalesce(v_usuario, 'sistema (' || coalesce(v_papel, current_user) || ')')
  );
  return null;
end;
$$;
