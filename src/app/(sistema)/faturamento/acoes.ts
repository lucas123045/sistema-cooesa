"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { podeEditar } from "@/lib/papeis";
import { errosPorCampo } from "@/lib/registros/esquema";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import { lerValorBR } from "@/lib/valores";

export type EstadoNota = { erro?: string; campos?: Record<string, string> };

const dataOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
  .transform((v) => v || null);

const idOpcional = (mensagem: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isSafeInteger(v) && v > 0), mensagem);

const esquemaNota = z
  .object({
    numero: z.string().trim().max(80, "Número muito longo."),
    data_emissao: dataOpcional,
    data_credito: dataOpcional,
    cliente_id: idOpcional("Cliente inválido."),
    empresa_texto: z.string().trim().max(240, "Texto muito longo."),
    titulo: z.string().trim().max(500, "Título muito longo."),
    valor: z.string().transform((v, ctx) => {
      const n = lerValorBR(v);
      if (n === null || Number.isNaN(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: "Informe um valor maior que zero, no formato 1.234,56." });
        return z.NEVER;
      }
      return n;
    }),
    ano: z.string().transform((v, ctx) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1990 || n > 2100) {
        ctx.addIssue({ code: "custom", message: "Informe um ano válido." });
        return z.NEVER;
      }
      return n;
    }),
    registro_num: idOpcional("Número de registro inválido."),
  })
  .refine((d) => !d.data_emissao || !d.data_credito || d.data_credito >= d.data_emissao, {
    message: "O crédito não pode ser antes da emissão.",
    path: ["data_credito"],
  });

const CAMPOS = [
  "numero",
  "data_emissao",
  "data_credito",
  "cliente_id",
  "empresa_texto",
  "titulo",
  "valor",
  "ano",
  "registro_num",
];

export async function salvarNota(_: EstadoNota, form: FormData): Promise<EstadoNota> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite criar ou editar notas fiscais." };

  const entrada = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const r = esquemaNota.safeParse(entrada);
  if (!r.success) return { erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };
  const d = r.data;

  const idTexto = String(form.get("id") ?? "");
  const id = idTexto ? Number(idTexto) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) return { erro: "Nota inválida." };

  const db = await criarClienteServidor();
  if (d.registro_num) {
    const { data: reg } = await db.from("registros").select("num").eq("num", d.registro_num).maybeSingle();
    if (!reg)
      return { erro: "Corrija os campos destacados.", campos: { registro_num: `O registro Nº ${d.registro_num} não existe.` } };
  }

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
  const resultado =
    id === null
      ? await db.from("notas_fiscais").insert(linha).select("id").single()
      : await db.from("notas_fiscais").update(linha).eq("id", id).select("id").maybeSingle();
  if (resultado.error || !resultado.data)
    return { erro: "O banco recusou a gravação. Confira os campos e se o seu papel permite editar." };

  revalidatePath("/", "layout");
  redirect(`/faturamento?ano=${d.ano}&salvo=1`);
}
