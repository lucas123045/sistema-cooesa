"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { podeEditar } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

export async function vincularAcompanhamento(form: FormData) {
  const sessao = await obterSessao();
  const dados = z.object({ id: z.coerce.number().int().positive(), registro_num: z.coerce.number().int().positive() }).safeParse({ id: form.get("id"), registro_num: form.get("registro_num") });
  if (!sessao || !podeEditar(sessao.papel) || !dados.success) redirect("/pendencias?erro=permissao");
  const db = await criarClienteServidor();
  const { data, error } = await db.from("acompanhamentos").update({ registro_num: dados.data.registro_num }).eq("id", dados.data.id).is("registro_num", null).select("id").maybeSingle();
  if (error || !data) redirect(`/pendencias/acompanhamento/${dados.data.id}?erro=vincular`);
  revalidatePath("/pendencias");
  revalidatePath(`/registros/${dados.data.registro_num}`);
  redirect(`/registros/${dados.data.registro_num}?vinculado=1`);
}
