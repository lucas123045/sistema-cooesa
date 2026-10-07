"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { podeEditar } from "@/lib/papeis";
import { MOTIVOS_PERDA } from "@/lib/propostas";
import { errosPorCampo } from "@/lib/registros/esquema";
import { eContratoTotal, SITUACOES } from "@/lib/situacoes";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import { lerValorBR } from "@/lib/valores";

export type EstadoSituacao = { erro?: string; campos?: Record<string, string> };

const data = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
  .transform((v) => v || null);

const esquema = z.object({
  num: z.coerce.number().int().positive(),
  situacao: z.enum(SITUACOES, { message: "Escolha a nova situação." }),
  data_enc: data,
  motivo_perda: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (MOTIVOS_PERDA as readonly string[]).includes(v), "Motivo inválido."),
  valor_vencedor: z.string().transform((v, ctx) => {
    const n = lerValorBR(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use 1.234,56." });
      return z.NEVER;
    }
    return n;
  }),
  anotacao: z.string().trim().max(4000),
  atualizar_empresa: z.boolean(),
});

/**
 * Atualiza a situação de uma proposta e registra a anotação no acompanhamento.
 * Opcionalmente (marcado por padrão) passa a empresa a Cliente ativo quando vira contrato.
 */
export async function atualizarSituacao(_: EstadoSituacao, form: FormData): Promise<EstadoSituacao> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite atualizar propostas." };
  const r = esquema.safeParse({
    num: form.get("num"),
    situacao: form.get("situacao"),
    data_enc: String(form.get("data_enc") ?? ""),
    motivo_perda: String(form.get("motivo_perda") ?? ""),
    valor_vencedor: String(form.get("valor_vencedor") ?? ""),
    anotacao: String(form.get("anotacao") ?? ""),
    atualizar_empresa: form.get("atualizar_empresa") === "1",
  });
  if (!r.success) return { erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };
  const d = r.data;
  const perdida = d.situacao === "Proposta colocada - negativa" || d.situacao === "Proposta cancelada";

  const db = await criarClienteServidor();
  const { data: atual } = await db.from("registros").select("situacao, cliente_id, data_ini").eq("num", d.num).maybeSingle();
  if (!atual) return { erro: `O registro Nº ${d.num} não existe mais.` };
  if (d.data_enc && atual.data_ini && d.data_enc < atual.data_ini) {
    return { erro: "Corrija os campos destacados.", campos: { data_enc: "O encerramento não pode ser antes do início." } };
  }

  const mudancas: Record<string, unknown> = { situacao: d.situacao };
  if (d.situacao === "Contrato encerrado" && d.data_enc) mudancas.data_enc = d.data_enc;
  if (perdida) {
    mudancas.motivo_perda = d.motivo_perda;
    if (d.valor_vencedor !== null) mudancas.valor_vencedor = d.valor_vencedor;
  }
  const { error } = await db.from("registros").update(mudancas).eq("num", d.num).select("num").single();
  if (error) {
    return {
      erro: error.message.includes("does not exist")
        ? "O banco ainda não tem os campos novos de proposta. Peça ao administrador para aplicar as migrações."
        : "A situação não foi salva. Confira seu papel e tente de novo.",
    };
  }

  // Anotação no acompanhamento (sempre registra a mudança; o texto é opcional).
  const resumo = [
    `${atual.situacao ?? "Sem situação"} → ${d.situacao}`,
    d.motivo_perda ? `motivo: ${d.motivo_perda}` : null,
    d.anotacao || null,
  ]
    .filter(Boolean)
    .join(" · ");
  await db.from("acompanhamentos").insert({ registro_num: d.num, fonte: "Sistema", situacao_na_epoca: d.situacao, obs: resumo });

  if (d.atualizar_empresa && eContratoTotal(d.situacao)) {
    // Não mexe em quem já é cliente ativo nem em "Não atender" (decisão de alguém).
    const { data: empresa } = await db.from("clientes").select("status").eq("id", atual.cliente_id).maybeSingle();
    if (
      empresa &&
      (empresa.status === null || ["Prospecção", "Proposta em andamento", "Cliente inativo"].includes(empresa.status))
    ) {
      await db.from("clientes").update({ status: "Cliente ativo" }).eq("id", atual.cliente_id);
    }
  }

  revalidatePath("/", "layout");
  redirect(`/registros/${d.num}?salvo=1`);
}
