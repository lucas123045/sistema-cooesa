import { z } from "zod";
import { UFS } from "@/lib/empresas";
import { lerValorBR } from "@/lib/valores";

/**
 * Dados técnicos e comerciais da proposta (migração 20261009120000).
 * Os vocabulários abaixo também estão nas regras do banco — há teste conferindo.
 */

export const MODALIDADES = ["Contratação direta", "Licitação pública", "Concorrência privada", "Aditivo de contrato"] as const;

export const MOTIVOS_PERDA = [
  "Preço",
  "Prazo",
  "Qualificação técnica",
  "Escopo alterado",
  "Cancelado pelo cliente",
  "Sem retorno do cliente",
  "Outro",
] as const;

/** Quais características técnicas fazem sentido em cada área (as demais ficam ocultas, mas podem ser abertas). */
export function caracteristicasDaArea(area: string | null | undefined): {
  potencia: boolean;
  tensao: boolean;
  extensao: boolean;
} {
  const a = (area ?? "").toLowerCase();
  if (a.startsWith("gera")) return { potencia: true, tensao: true, extensao: false };
  if (a.startsWith("transm")) return { potencia: false, tensao: true, extensao: true };
  if (a.startsWith("distrib")) return { potencia: false, tensao: true, extensao: true };
  return { potencia: false, tensao: false, extensao: false };
}

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const numero = (opcoes: { inteiro?: boolean; max: number; rotulo: string }) =>
  z.string().transform((v, ctx) => {
    const n = lerValorBR(v);
    if (n === null) return null;
    if (Number.isNaN(n) || n < 0 || n > opcoes.max || (opcoes.inteiro && !Number.isInteger(n))) {
      ctx.addIssue({ code: "custom", message: `${opcoes.rotulo} inválido.` });
      return z.NEVER;
    }
    return n;
  });

const vocabulario = <T extends readonly string[]>(lista: T, mensagem: string) =>
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (lista as readonly string[]).includes(v), mensagem);

export const esquemaTecnico = z.object({
  descricao: texto(8000),
  obra: texto(200),
  local_municipio: texto(120),
  local_uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (UFS as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  cliente_final: texto(200),
  potencia_mw: numero({ max: 99_999_999, rotulo: "Potência" }),
  tensao_kv: numero({ max: 999_999, rotulo: "Tensão" }),
  extensao_km: numero({ max: 99_999_999, rotulo: "Extensão" }),
  modalidade: vocabulario(MODALIDADES, "Modalidade inválida."),
  edital: texto(120),
  revisao: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return 0;
      const n = Number(v.replace(/^r/i, ""));
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        ctx.addIssue({ code: "custom", message: "Revisão inválida (0 a 99)." });
        return z.NEVER;
      }
      return n;
    }),
  validade_dias: numero({ inteiro: true, max: 3650, rotulo: "Validade" }),
  prazo_meses: numero({ max: 999, rotulo: "Prazo" }),
  horas_estimadas: numero({ inteiro: true, max: 9_999_999, rotulo: "Horas" }),
  responsavel_tecnico: texto(120),
  concorrentes: texto(1000),
  motivo_perda: vocabulario(MOTIVOS_PERDA, "Motivo inválido."),
});

export type DadosTecnicos = z.output<typeof esquemaTecnico>;

export const CAMPOS_TECNICOS = Object.keys(esquemaTecnico.shape) as (keyof DadosTecnicos)[];
