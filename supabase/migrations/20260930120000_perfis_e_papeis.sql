-- =====================================================================
-- Fase 1 — Perfis e papéis de acesso
--   admin   : tudo (excluir, unificar clientes, usuários, configurações)
--   editor  : lê, cria e edita registros, notas e acompanhamentos
--   leitura : só lê
-- Não há cadastro público: contas são criadas por um admin.
-- =====================================================================

create table public.perfis (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null default '',
  papel     text not null default 'leitura' check (papel in ('admin', 'editor', 'leitura')),
  criado_em timestamptz not null default now()
);

comment on table public.perfis is 'Papel de cada usuário do Supabase Auth no sistema.';

alter table public.perfis enable row level security;

-- ---------------------------------------------------------------------
-- Funções auxiliares de autorização (usadas nas políticas de RLS).
-- security definer: leem perfis sem depender do RLS de perfis (evita recursão).
-- ---------------------------------------------------------------------

create function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel from public.perfis p where p.user_id = auth.uid()
$$;

create function public.pode_ler()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.papel_atual() in ('admin', 'editor', 'leitura'), false)
$$;

create function public.pode_editar()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.papel_atual() in ('admin', 'editor'), false)
$$;

create function public.e_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.papel_atual() = 'admin', false)
$$;

-- ---------------------------------------------------------------------
-- Políticas: cada um vê o próprio perfil; admin vê e altera todos.
-- ---------------------------------------------------------------------

create policy "perfis: ler o próprio ou admin"
  on public.perfis for select to authenticated
  using (user_id = auth.uid() or public.e_admin());

create policy "perfis: admin insere"
  on public.perfis for insert to authenticated
  with check (public.e_admin());

create policy "perfis: admin altera"
  on public.perfis for update to authenticated
  using (public.e_admin())
  with check (public.e_admin());

create policy "perfis: admin exclui"
  on public.perfis for delete to authenticated
  using (public.e_admin());

revoke all on table public.perfis from anon;

-- ---------------------------------------------------------------------
-- Todo usuário novo do Auth ganha um perfil "leitura".
-- O admin promove depois (Configurações → Usuários).
-- ---------------------------------------------------------------------

create function public.criar_perfil_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (user_id, nome, papel)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(coalesce(new.email, ''), '@', 1)),
    -- o papel inicial vem de app_metadata (só a service_role escreve ali),
    -- nunca de user_metadata, que o próprio usuário controla.
    case when new.raw_app_meta_data ->> 'papel' in ('admin', 'editor', 'leitura')
         then new.raw_app_meta_data ->> 'papel' else 'leitura' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_para_novo_usuario();
