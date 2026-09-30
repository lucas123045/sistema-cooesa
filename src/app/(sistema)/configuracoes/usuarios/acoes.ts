"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

export async function alterarPapel(form: FormData) {
  const sessao = await obterSessao();
  const dados = z.object({ user_id: z.string().uuid(), papel: z.enum(["admin", "editor", "leitura"]) }).safeParse({ user_id: form.get("user_id"), papel: form.get("papel") });
  if (!sessao || !eAdmin(sessao.papel) || !dados.success) redirect("/configuracoes/usuarios?erro=permissao");
  const db = await criarClienteServidor();
  const { data: alvo, error: erroAlvo } = await db.from("perfis").select("papel").eq("user_id", dados.data.user_id).maybeSingle();
  if (erroAlvo || !alvo) redirect("/configuracoes/usuarios?erro=salvar");
  if (alvo.papel === "admin" && dados.data.papel !== "admin") {
    const { count, error } = await db.from("perfis").select("user_id", { count: "exact", head: true }).eq("papel", "admin");
    if (error || (count ?? 0) < 2) redirect("/configuracoes/usuarios?erro=ultimo-admin");
  }
  const { error } = await db.from("perfis").update({ papel: dados.data.papel }).eq("user_id", dados.data.user_id);
  if (error) redirect("/configuracoes/usuarios?erro=salvar");
  revalidatePath("/configuracoes/usuarios");
  redirect("/configuracoes/usuarios?salvo=1");
}
