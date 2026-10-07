"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { podeEditar } from "@/lib/papeis";
import { PENDENCIAS_SO_CORRECAO, ROTULO_TIPO_PENDENCIA } from "@/lib/rotulos";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

const esquema = z.object({
  tipo: z.string().refine((t) => t in ROTULO_TIPO_PENDENCIA && !PENDENCIAS_SO_CORRECAO.has(t), "Tipo de pendência inválido."),
  chave: z.string().min(1).max(200),
});

/** Marca uma pendência como revisada (some da lista). Editor ou admin. */
export async function marcarRevisada(form: FormData) {
  const sessao = await obterSessao();
  const dados = esquema.safeParse({ tipo: form.get("tipo"), chave: form.get("chave") });
  if (!sessao || !podeEditar(sessao.papel)) redirect("/pendencias?erro=permissao");
  if (!dados.success) redirect("/pendencias?erro=tipo");

  const db = await criarClienteServidor();
  // ignoreDuplicates = ON CONFLICT DO NOTHING: um segundo clique não dá erro.
  const { error } = await db
    .from("pendencias_revisadas")
    .upsert(
      { tipo: dados.data.tipo, chave: dados.data.chave, revisado_por: sessao.userId },
      { onConflict: "tipo,chave", ignoreDuplicates: true },
    );
  if (error) redirect("/pendencias?erro=salvar");
  revalidatePath("/", "layout");
}
