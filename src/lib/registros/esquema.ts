import { z } from "zod";
import { SITUACOES } from "@/lib/situacoes";
import { lerValorBR } from "@/lib/valores";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v.replace(/\s+/g, " ")));

const dataOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida. Use dd/mm/aaaa.")
  .transform((v) => (v === "" ? null : v));

const valorOpcional = z
  .string()
  .transform((v, ctx) => {
    const n = lerValorBR(v);
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Use o formato 1.234,56." });
      return z.NEVER;
    }
    if (n !== null && n < 0) {
      ctx.addIssue({ code: "custom", message: "O valor não pode ser negativo." });
      return z.NEVER;
    }
    return n;
  });

/** Nome de cliente como é gravado: maiúsculas, espaços simples. */
export function normalizarNomeCliente(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export const esquemaRegistro = z
  .object({
    cliente: z
      .string()
      .trim()
      .min(1, "Informe o cliente.")
      .max(200, "Nome de cliente muito longo.")
      .transform(normalizarNomeCliente),
    contato: textoOpcional(300),
    gerente: textoOpcional(120),
    escopo: textoOpcional(4000),
    situacao: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || (SITUACOES as readonly string[]).includes(v), "Situação inválida."),
    data_ini: dataOpcional,
    data_enc: dataOpcional,
    tipo: z.enum(["P", "T"], { message: "Escolha P (valor total) ou T (valor mensal)." }),
    valor: valorOpcional,
    valor_vencedor: valorOpcional,
    entidade: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || v === "Cooesa Ltda" || v === "Cooperativa", "Entidade inválida."),
    obs: textoOpcional(4000),
    ano: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1990 || n > 2100) {
          ctx.addIssue({ code: "custom", message: "Ano inválido." });
          return z.NEVER;
        }
        return n;
      }),
    setor: textoOpcional(120),
    area: textoOpcional(120),
    empreendimento: textoOpcional(120),
    servico: textoOpcional(120),
    especialidade: textoOpcional(120),
  })
  .refine((d) => !d.data_ini || !d.data_enc || d.data_enc >= d.data_ini, {
    message: "O encerramento não pode ser antes do início.",
    path: ["data_enc"],
  });

export type DadosRegistro = z.output<typeof esquemaRegistro>;

export const CAMPOS_REGISTRO = [
  "cliente",
  "contato",
  "gerente",
  "escopo",
  "situacao",
  "data_ini",
  "data_enc",
  "tipo",
  "valor",
  "valor_vencedor",
  "entidade",
  "obs",
  "ano",
  "setor",
  "area",
  "empreendimento",
  "servico",
  "especialidade",
] as const;

/** Converte FormData no objeto de entrada do esquema (campos ausentes viram ""). */
export function lerFormulario(dados: FormData, campos: readonly string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const c of campos) {
    const v = dados.get(c);
    obj[c] = typeof v === "string" ? v : "";
  }
  return obj;
}

/** Erros do zod por campo (primeira mensagem de cada). */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const k = String(issue.path[0] ?? "_");
    if (!campos[k]) campos[k] = issue.message;
  }
  return campos;
}
