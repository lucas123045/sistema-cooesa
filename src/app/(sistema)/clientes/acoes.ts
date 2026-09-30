"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

export async function unificarCliente(form: FormData) {
  const sessao = await obterSessao();
  const dados = z.object({ origem: z.coerce.number().int().positive(), destino: z.coerce.number().int().positive() }).safeParse({ origem: form.get("origem"), destino: form.get("destino") });
  if (!sessao || !eAdmin(sessao.papel) || !dados.success || dados.data.origem === dados.data.destino) redirect("/clientes?erro=permissao");
  const db = await criarClienteServidor();
  const { error } = await db.rpc("unificar_clientes", { p_origem: dados.data.origem, p_destino: dados.data.destino });
  if (error) redirect(`/clientes/${dados.data.destino}?unificar=${dados.data.origem}&erro=unificar`);
  revalidatePath("/clientes");
  revalidatePath("/faturamento");
  revalidatePath("/", "layout");
  redirect(`/clientes/${dados.data.destino}?unificado=1`);
}
