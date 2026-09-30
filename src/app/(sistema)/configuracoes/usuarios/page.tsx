import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/supabase/server";
import { alterarPapel } from "./acoes";

export const metadata: Metadata = { title: "Usuários" };
export default async function Usuarios(props: { searchParams: Promise<{ salvo?: string; erro?: string }> }) {
  await exigirSessao("admin");
  const query = await props.searchParams;
  const admin = criarClienteAdmin();
  const [{ data, error }, { data: perfis, error: erroPerfis }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("perfis").select("user_id,nome,papel,criado_em").order("nome"),
  ]);
  const porId = new Map((perfis ?? []).map((p) => [p.user_id, p]));
  const usuarios = data.users.map((u) => ({ id: u.id, email: u.email ?? "", perfil: porId.get(u.id) }));
  return <><CabecalhoPagina sobre={<Link href="/configuracoes">Configurações</Link>} titulo="Usuários e permissões" descricao="Ajuste os papéis de acesso. Contas novas são criadas pelo administrador do projeto Supabase e começam com leitura."/><section className="painel">
    {query.salvo ? <p className="aviso aviso-sucesso">Permissão atualizada.</p> : null}
    {query.erro ? <p className="aviso aviso-erro">{query.erro === "ultimo-admin" ? "Mantenha pelo menos um administrador ativo." : "Não foi possível salvar a permissão."}</p> : null}
    {error || erroPerfis ? <p className="aviso aviso-erro">Não foi possível carregar os usuários. Confira a SUPABASE_SERVICE_ROLE_KEY no servidor.</p> : <div className="tabela-rolagem"><table className="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Permissão</th></tr></thead><tbody>{usuarios.map((u) => <tr key={u.id}><td>{u.perfil?.nome || "—"}</td><td>{u.email}</td><td>{u.perfil?.papel ?? "sem perfil"}</td><td>{u.perfil ? <form action={alterarPapel} className="atalhos"><input type="hidden" name="user_id" value={u.id}/><label className="sr-only" htmlFor={`papel-${u.id}`}>Papel para {u.email}</label><select id={`papel-${u.id}`} name="papel" defaultValue={u.perfil.papel}><option value="leitura">Leitura</option><option value="editor">Editor</option><option value="admin">Administrador</option></select><button className="btn btn-pequeno" type="submit">Atualizar</button></form> : <span className="muted">Verifique o perfil no Supabase</span>}</td></tr>)}</tbody></table></div>}
  </section></>;
}
