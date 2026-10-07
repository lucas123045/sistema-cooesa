"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

const CHAVES = ["aliquota_irpj", "aliquota_csll", "aliquota_cofins", "aliquota_pis", "aliquota_inss", "aliquota_iss"] as const;

// Aceita "4,0219" ou "4.0219"; vazio é erro (não vira 0 em silêncio).
const aliquota = z
  .string()
  .trim()
  .min(1)
  .transform((v) => Number(v.replace(",", ".")))
  .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100);

/** Salva as alíquotas estimadas (% sobre o valor da nota). Só admin. */
export async function salvarAliquotas(form: FormData) {
  const sessao = await obterSessao();
  if (!sessao || !eAdmin(sessao.papel)) redirect("/?sem-permissao=1");

  const valores: Record<string, number> = {};
  for (const chave of CHAVES) {
    const r = aliquota.safeParse(String(form.get(chave) ?? ""));
    if (!r.success) redirect(`/configuracoes?erro=valor&campo=${chave}`);
    valores[chave] = r.data;
  }

  const db = await criarClienteServidor();
  const { error } = await db.from("configuracoes").upsert(
    CHAVES.map((chave) => ({
      chave,
      valor: valores[chave],
      atualizado_por: sessao.userId,
      atualizado_em: new Date().toISOString(),
    })),
    {
      onConflict: "chave",
    },
  );
  if (error) redirect("/configuracoes?erro=salvar");

  revalidatePath("/faturamento");
  redirect("/configuracoes?salvo=1");
}
