"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

const esquema = z.object({
  origem: z.coerce.number().int().positive(),
  destino: z.coerce.number().int().positive(),
  confirmo: z.literal("1"),
});

/** Unifica dois clientes (só admin). A regra mora na função unificar_clientes do banco. */
export async function unificarCliente(form: FormData) {
  const sessao = await obterSessao();
  const dados = esquema.safeParse({ origem: form.get("origem"), destino: form.get("destino"), confirmo: form.get("confirmo") });
  const destino = Number(form.get("destino"));
  if (!sessao || !eAdmin(sessao.papel)) redirect(`/clientes/${destino}?erro=unificar`);
  if (!dados.success || dados.data.origem === dados.data.destino) {
    redirect(`/clientes/${destino}?outro=${Number(form.get("origem"))}&fica=este&erro=confirmar`);
  }

  const db = await criarClienteServidor();
  const { data, error } = await db.rpc("unificar_clientes", { p_origem: dados.data.origem, p_destino: dados.data.destino });
  if (error) redirect(`/clientes/${dados.data.destino}?erro=unificar`);

  revalidatePath("/", "layout");
  const nomeOrigem = (data as { origem?: string } | null)?.origem ?? "";
  redirect(`/clientes/${dados.data.destino}?unificado=${encodeURIComponent(nomeOrigem)}`);
}
