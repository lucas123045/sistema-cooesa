"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obterOuCriarCliente } from "@/lib/clientes";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { CAMPOS_TECNICOS, esquemaTecnico } from "@/lib/propostas";
import { CAMPOS_REGISTRO, errosPorCampo, esquemaRegistro, lerFormulario } from "@/lib/registros/esquema";
import { eContratoTotal } from "@/lib/situacoes";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import { lerValorBR } from "@/lib/valores";

export type EstadoRegistro = { erro?: string; campos?: Record<string, string> };

const LIMITE_LEGADO = 1059;
const TIPOS_REVISAVEIS_NO_FORM = ["data_encerramento", "valor_texto", "cliente_unificado"];

/** Cria (num ausente) ou atualiza um registro. */
export async function salvarRegistro(_: EstadoRegistro, dados: FormData): Promise<EstadoRegistro> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite criar ou editar registros." };

  const numTexto = dados.get("num");
  const num = typeof numTexto === "string" && numTexto ? Number(numTexto) : null;
  const r = esquemaRegistro.safeParse(lerFormulario(dados, CAMPOS_REGISTRO));
  // Dados técnicos e comerciais: só entram quando o formulário os traz (marcador com_tecnicos),
  // para um formulário antigo nunca apagar o que já foi preenchido.
  const comTecnicos = dados.get("com_tecnicos") === "1";
  const rt = comTecnicos ? esquemaTecnico.safeParse(lerFormulario(dados, CAMPOS_TECNICOS)) : null;
  if (!r.success || (rt && !rt.success)) {
    return {
      erro: "Corrija os campos destacados.",
      campos: { ...(rt && !rt.success ? errosPorCampo(rt.error) : {}), ...(!r.success ? errosPorCampo(r.error) : {}) },
    };
  }
  const d = r.data;
  const tecnicos = rt?.success ? rt.data : {};
  const chaveEnvio = String(dados.get("chave_envio") ?? "").slice(0, 64) || null;

  const supabase = await criarClienteServidor();

  // Situação e escopo só podem ficar vazios em registros legados que já estavam vazios.
  let atual: { situacao: string | null; escopo: string | null } | null = null;
  if (num) {
    const { data } = await supabase.from("registros").select("situacao, escopo").eq("num", num).maybeSingle();
    if (!data) return { erro: `O registro Nº ${num} não existe mais.` };
    atual = data as { situacao: string | null; escopo: string | null };
  }
  const legado = num !== null && num <= LIMITE_LEGADO;
  const campos: Record<string, string> = {};
  if (!d.situacao && !(legado && atual?.situacao === null)) campos.situacao = "Escolha a situação.";
  if (!d.escopo && !(legado && !atual?.escopo)) campos.escopo = "Descreva o escopo do serviço.";
  if (Object.keys(campos).length) return { erro: "Corrija os campos destacados.", campos };

  const cliente = await obterOuCriarCliente(supabase, d.cliente);
  if ("erro" in cliente) return { erro: cliente.erro, campos: { cliente: cliente.erro } };
  // Empresa criada agora, junto com a proposta: já nasce com um status coerente.
  if (cliente.criado) {
    await supabase
      .from("clientes")
      .update({ status: eContratoTotal(d.situacao) ? "Cliente ativo" : "Proposta em andamento" })
      .eq("id", cliente.id);
  }

  const linha = {
    cliente_id: cliente.id,
    contato: d.contato,
    gerente: d.gerente,
    escopo: d.escopo,
    situacao: d.situacao,
    data_ini: d.data_ini,
    data_enc: d.data_enc,
    tipo: d.tipo,
    valor: d.valor,
    valor_vencedor: d.valor_vencedor,
    entidade: d.entidade,
    obs: d.obs,
    ano: d.ano,
    setor: d.setor,
    area: d.area,
    empreendimento: d.empreendimento,
    servico: d.servico,
    especialidade: d.especialidade,
    ...tecnicos,
  };

  let destino: number;
  if (num) {
    const { data, error } = await supabase.from("registros").update(linha).eq("num", num).select("num").maybeSingle();
    if (error || !data) return { erro: mensagemErroBanco(error?.message) };
    destino = num;
  } else {
    const { data, error } = await supabase
      .from("registros")
      .insert({ ...linha, chave_envio: chaveEnvio })
      .select("num")
      .single();
    if (error?.message.includes("registros_chave_envio_unica") && chaveEnvio) {
      // Mesmo envio chegou duas vezes (clique duplo, rede lenta): devolve a proposta já criada.
      const { data: existente } = await supabase.from("registros").select("num").eq("chave_envio", chaveEnvio).maybeSingle();
      if (existente) redirect(`/registros/${existente.num}?salvo=1`);
    }
    if (error || !data) return { erro: mensagemErroBanco(error?.message) };
    destino = data.num as number;
  }

  // Pendências deste registro que o usuário confirmou como revisadas no formulário.
  const revisar = dados
    .getAll("revisar")
    .filter((v): v is string => typeof v === "string" && TIPOS_REVISAVEIS_NO_FORM.includes(v));
  if (revisar.length) {
    await supabase.from("pendencias_revisadas").upsert(
      revisar.map((tipo) => ({ tipo, chave: String(destino), revisado_por: sessao.userId })),
      { onConflict: "tipo,chave", ignoreDuplicates: true },
    );
  }

  revalidatePath("/", "layout");
  redirect(`/registros/${destino}?salvo=1`);
}

function mensagemErroBanco(msg?: string): string {
  if (!msg) return "Você não tem permissão para esta alteração.";
  if (msg.includes("registros_situacao")) return "Situação inválida para este registro.";
  if (msg.includes("registros_escopo")) return "O escopo é obrigatório.";
  if (msg.includes("registros_tecnicos_positivos")) return "Potência, tensão, extensão, prazo e horas não podem ser negativos.";
  if (msg.includes("registros_modalidade") || msg.includes("registros_motivo") || msg.includes("registros_local_uf"))
    return "Algum valor escolhido não é aceito. Confira modalidade, motivo e UF.";
  if (msg.includes("column") && msg.includes("does not exist"))
    return "O banco ainda não tem os campos novos de proposta. Peça ao administrador para aplicar as migrações (supabase db push).";
  if (msg.includes("row-level security")) return "Seu papel não permite esta alteração.";
  return "O banco recusou a gravação. Confira os campos e tente de novo.";
}

const esquemaAcompanhamento = z.object({
  registro_num: z.coerce.number().int().positive(),
  obs: z.string().trim().min(1, "Escreva a anotação.").max(4000),
  a_receber: z.string().transform((v) => lerValorBR(v)),
});

export async function adicionarAcompanhamento(_: EstadoRegistro, dados: FormData): Promise<EstadoRegistro> {
  const sessao = await obterSessao();
  if (!sessao || !podeEditar(sessao.papel)) return { erro: "Seu papel não permite adicionar anotações." };
  const r = esquemaAcompanhamento.safeParse({
    registro_num: dados.get("registro_num"),
    obs: dados.get("obs") ?? "",
    a_receber: dados.get("a_receber") ?? "",
  });
  if (!r.success) return { erro: r.error.issues[0]?.message };
  if (r.data.a_receber !== null && Number.isNaN(r.data.a_receber)) return { erro: "Valor a receber inválido. Use 1.234,56." };

  const supabase = await criarClienteServidor();
  const { data: reg } = await supabase.from("registros").select("situacao").eq("num", r.data.registro_num).maybeSingle();
  const { error } = await supabase.from("acompanhamentos").insert({
    registro_num: r.data.registro_num,
    fonte: "Sistema",
    situacao_na_epoca: (reg?.situacao as string | null) ?? null,
    obs: r.data.obs,
    a_receber: r.data.a_receber,
  });
  if (error) return { erro: mensagemErroBanco(error.message) };
  revalidatePath(`/registros/${r.data.registro_num}`);
  return {};
}

export async function excluirRegistro(dados: FormData) {
  const sessao = await obterSessao();
  const num = Number(dados.get("num"));
  if (!sessao || !eAdmin(sessao.papel) || !Number.isInteger(num)) redirect(`/registros/${num}?erro=permissao`);
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("registros").delete({ count: "exact" }).eq("num", num);
  if (error || !count) redirect(`/registros/${num}?erro=excluir`);
  revalidatePath("/", "layout");
  redirect(`/registros?excluido=${num}`);
}
