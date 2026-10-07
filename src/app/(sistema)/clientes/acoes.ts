"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CAMPOS_EMPRESA, esquemaEmpresa } from "@/lib/empresas-esquema";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { errosPorCampo, lerFormulario } from "@/lib/registros/esquema";
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

/** Grava o status sugerido nas empresas sem status (só admin; nunca sobrescreve). */
export async function aplicarSugestoes(form: FormData) {
  const sessao = await obterSessao();
  if (!sessao || !eAdmin(sessao.papel) || form.get("confirmo") !== "1") redirect("/clientes/status-sugerido?erro=1");
  const db = await criarClienteServidor();
  const { error } = await db.rpc("aplicar_status_sugerido");
  if (error) redirect("/clientes/status-sugerido?erro=1");
  revalidatePath("/clientes");
  redirect("/clientes?aplicado=1");
}

export type EstadoEmpresa = { erro?: string; campos?: Record<string, string> };

/** Cria (sem id) ou atualiza uma empresa. Renomear só vale para admin (o banco também barra). */
export async function salvarEmpresa(_: EstadoEmpresa, form: FormData): Promise<EstadoEmpresa> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite cadastrar ou editar empresas." };

  const idTexto = String(form.get("id") ?? "");
  const id = idTexto ? Number(idTexto) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) return { erro: "Empresa inválida." };

  const r = esquemaEmpresa.safeParse(lerFormulario(form, CAMPOS_EMPRESA));
  if (!r.success) return { erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };
  const { nome, ...resto } = r.data;

  const db = await criarClienteServidor();
  // Editor não renomeia: o nome só entra na gravação para quem é admin (ou ao criar).
  const linha = id === null || eAdmin(sessao.papel) ? { nome, ...resto } : resto;
  const resultado =
    id === null
      ? await db.from("clientes").insert(linha).select("id").single()
      : await db.from("clientes").update(linha).eq("id", id).select("id").maybeSingle();

  if (resultado.error) {
    const msg = resultado.error.message;
    if (msg.includes("clientes_nome_key"))
      return { erro: "Corrija os campos destacados.", campos: { nome: "Já existe uma empresa com esse nome." } };
    if (msg.includes("clientes_cnpj_unico"))
      return { erro: "Corrija os campos destacados.", campos: { cnpj: "Esse CNPJ já está em outra empresa." } };
    if (msg.includes("renomear")) return { erro: "Só administradores podem renomear empresas." };
    return { erro: "O banco recusou a gravação. Confira os campos e tente de novo." };
  }
  if (!resultado.data) return { erro: "Seu papel não permite esta alteração." };

  revalidatePath("/clientes");
  redirect(`/clientes/${resultado.data.id}?salvo=1`);
}
