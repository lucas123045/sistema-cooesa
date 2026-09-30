"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { podeEditar } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import { lerValorBR } from "@/lib/valores";

const dataOpcional = z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.").transform((v) => v || null);
const formularioNota = z.object({
  id: z.string().optional(),
  numero: z.string().trim().max(80),
  data_emissao: dataOpcional,
  data_credito: dataOpcional,
  cliente_id: z.string().transform((v) => v ? Number(v) : null).refine((v) => v === null || (Number.isSafeInteger(v) && v > 0), "Cliente inválido."),
  empresa_texto: z.string().trim().max(240),
  titulo: z.string().trim().max(500),
  valor: z.string().transform((v, ctx) => {
    const n = lerValorBR(v);
    if (n === null || Number.isNaN(n) || n <= 0) { ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero." }); return z.NEVER; }
    return n;
  }),
  ano: z.string().transform((v, ctx) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1990 || n > 2100) { ctx.addIssue({ code: "custom", message: "Informe um ano válido." }); return z.NEVER; }
    return n;
  }),
  registro_num: z.string().transform((v) => v ? Number(v) : null).refine((v) => v === null || (Number.isSafeInteger(v) && v > 0), "Registro vinculado inválido."),
});

export async function salvarNota(form: FormData) {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) redirect("/faturamento?erro=permissao");
  const parsed = formularioNota.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/faturamento?erro=campos");
  const d = parsed.data;
  const id = d.id ? Number(d.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) redirect("/faturamento?erro=id");
  const linha = {
    numero: d.numero || null,
    data_emissao: d.data_emissao,
    data_credito: d.data_credito,
    cliente_id: d.cliente_id,
    empresa_texto: d.empresa_texto || null,
    titulo: d.titulo || null,
    valor: d.valor,
    ano: d.ano,
    registro_num: d.registro_num,
  };
  const db = await criarClienteServidor();
  const result = id === null
    ? await db.from("notas_fiscais").insert(linha).select("id").single()
    : await db.from("notas_fiscais").update(linha).eq("id", id).select("id").maybeSingle();
  if (result.error || !result.data) redirect("/faturamento?erro=salvar");
  revalidatePath("/faturamento");
  if (d.registro_num) revalidatePath(`/registros/${d.registro_num}`);
  redirect(`/faturamento?ano=${d.ano}&salvo=1`);
}
