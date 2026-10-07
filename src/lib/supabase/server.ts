import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Papel } from "@/lib/papeis";

export function variaveisSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (veja .env.example).",
    );
  }
  return { url, chave };
}

/** Cliente do Supabase para Server Components, Server Actions e Route Handlers (sessão do usuário, sujeito a RLS). */
export async function criarClienteServidor() {
  const { url, chave } = variaveisSupabase();
  const armazenamento = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return armazenamento.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) armazenamento.set(name, value, options);
        } catch {
          // Chamado a partir de um Server Component: o proxy.ts já renova a sessão.
        }
      },
    },
  });
}

export type Sessao = {
  userId: string;
  email: string;
  nome: string;
  papel: Papel;
  /** Verificação em dois passos ativada (e confirmada nesta sessão). */
  doisPassos: boolean;
};

/** Situação da verificação em dois passos da sessão atual. */
async function verificacao(supabase: Awaited<ReturnType<typeof criarClienteServidor>>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    ativa: data?.nextLevel === "aal2",
    pendente: data?.currentLevel === "aal1" && data?.nextLevel === "aal2",
  };
}

/**
 * Usuário logado, com perfil e com a verificação em dois passos cumprida (se ativada).
 * Memoizado por requisição. Retorna null em qualquer outro caso — ações de servidor
 * que dependem disso falham fechadas.
 */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const v = await verificacao(supabase);
  if (v.pendente) return null;
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!perfil) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    nome: (perfil.nome as string) || user.email || "",
    papel: perfil.papel as Papel,
    doisPassos: v.ativa,
  };
});

/** Exige sessão; opcionalmente exige papel mínimo. Redireciona se não atender. */
export async function exigirSessao(minimo: Papel = "leitura"): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) {
    const supabase = await criarClienteServidor();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login");
    // Falta o código da verificação em dois passos.
    if ((await verificacao(supabase)).pendente) redirect("/verificacao");
    // Logado sem perfil (conta criada fora do fluxo) vai para uma tela explicativa, sem loop.
    redirect("/sem-perfil");
  }
  const ordem: Record<Papel, number> = { leitura: 0, editor: 1, admin: 2 };
  if (ordem[sessao.papel] < ordem[minimo]) redirect("/?sem-permissao=1");
  return sessao;
}

/** Usuário autenticado só com a senha, que ainda precisa digitar o código (tela /verificacao). */
export async function precisaDeCodigo(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user) && (await verificacao(supabase)).pendente;
}
