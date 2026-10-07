"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eStatusEmpresa } from "@/lib/empresas";
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

/** Troca só o status da empresa (seletor no cabeçalho do detalhe). */
export async function alterarStatus(id: number, status: string): Promise<{ erro?: string }> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite alterar o status." };
  if (!Number.isSafeInteger(id) || !eStatusEmpresa(status)) return { erro: "Status inválido." };
  const db = await criarClienteServidor();
  const { data, error } = await db.from("clientes").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { erro: "O status não foi salvo. Tente de novo." };
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return {};
}

const esquemaContato = z.object({
  cliente_id: z.coerce.number().int().positive(),
  nome: z.string().trim().min(1, "Informe o nome do contato.").max(120),
  cargo: z.string().trim().max(120),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido."),
  telefone: z.string().trim().max(60),
  observacoes: z.string().trim().max(1000),
  principal: z.boolean(),
});

export type EstadoContato = { erro?: string; campos?: Record<string, string>; ok?: number };

/** Cria (sem id) ou atualiza um contato. Marcar como principal desmarca o anterior. */
export async function salvarContato(anterior: EstadoContato, form: FormData): Promise<EstadoContato> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite editar contatos." };
  const r = esquemaContato.safeParse({
    ...lerFormulario(form, ["cliente_id", "nome", "cargo", "email", "telefone", "observacoes"]),
    principal: form.get("principal") === "1",
  });
  if (!r.success) return { erro: "Corrija os campos destacados.", campos: errosPorCampo(r.error) };
  const idTexto = String(form.get("id") ?? "");
  const id = idTexto ? Number(idTexto) : null;
  const d = r.data;
  const linha = {
    cliente_id: d.cliente_id,
    nome: d.nome,
    cargo: d.cargo || null,
    email: d.email ? d.email.toLowerCase() : null,
    telefone: d.telefone || null,
    observacoes: d.observacoes || null,
    principal: d.principal,
  };

  const db = await criarClienteServidor();
  if (d.principal) {
    let desmarcar = db.from("contatos_empresa").update({ principal: false }).eq("cliente_id", d.cliente_id).eq("principal", true);
    if (id !== null) desmarcar = desmarcar.neq("id", id);
    await desmarcar;
  }
  const { error } =
    id === null
      ? await db.from("contatos_empresa").insert(linha)
      : await db.from("contatos_empresa").update(linha).eq("id", id).eq("cliente_id", d.cliente_id);
  if (error) return { erro: "O contato não foi salvo. Confira os campos e tente de novo." };
  revalidatePath(`/clientes/${d.cliente_id}`);
  return { ok: (anterior.ok ?? 0) + 1 };
}

export async function removerContato(id: number, clienteId: number): Promise<{ erro?: string }> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite remover contatos." };
  const db = await criarClienteServidor();
  const { error, count } = await db.from("contatos_empresa").delete({ count: "exact" }).eq("id", id).eq("cliente_id", clienteId);
  if (error || !count) return { erro: "O contato não foi removido." };
  revalidatePath(`/clientes/${clienteId}`);
  return {};
}
