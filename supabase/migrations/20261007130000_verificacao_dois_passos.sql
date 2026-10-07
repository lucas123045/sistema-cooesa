-- =====================================================================
-- Verificação em dois passos (TOTP) também no banco.
--
-- Quem ativou a verificação só ganha papel (leitura/editor/admin) depois
-- de digitar o código: o JWT precisa estar em aal2. Sem isso, uma senha
-- vazada daria acesso direto à API (PostgREST) mesmo que a tela pedisse
-- o código. Quem não ativou continua como antes (aal1 basta).
-- O próprio perfil continua legível em aal1 (a aplicação precisa dele
-- para mandar o usuário à tela do código).
-- =====================================================================

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel
    from public.perfis p
   where p.user_id = auth.uid()
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
          where f.user_id = p.user_id and f.status = 'verified'
       )
     )
$$;
