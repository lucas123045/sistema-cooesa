import { z } from "zod";
import { cnpjValido, somenteDigitos, STATUS_EMPRESA, UFS } from "@/lib/empresas";
import { normalizarNomeCliente } from "@/lib/registros/esquema";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v.replace(/\s+/g, " ")));

/** Formulário de empresa. `nome` é normalizado (maiúsculas) como o resto do sistema. */
export const esquemaEmpresa = z.object({
  nome: z.string().trim().min(2, "Informe o nome da empresa.").max(120, "Nome muito longo.").transform(normalizarNomeCliente),
  razao_social: opcional(200),
  cnpj: z
    .string()
    .trim()
    .transform((v) => somenteDigitos(v))
    .refine((v) => v === "" || cnpjValido(v), "CNPJ inválido. Confira os números.")
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(STATUS_EMPRESA, { message: "Escolha o status." }),
  setor: opcional(80),
  cidade: opcional(80),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (UFS as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  site: opcional(200).refine((v) => v === null || !/\s/.test(v), "Endereço de site inválido."),
  responsavel: opcional(120),
  origem: opcional(80),
  observacoes: opcional(4000),
});

export type DadosEmpresa = z.output<typeof esquemaEmpresa>;

export const CAMPOS_EMPRESA = [
  "nome",
  "razao_social",
  "cnpj",
  "status",
  "setor",
  "cidade",
  "uf",
  "site",
  "responsavel",
  "origem",
  "observacoes",
] as const;

export const ORIGENS_SUGERIDAS = ["Indicação", "Licitação", "Cliente antigo", "Site", "Evento", "Prospecção ativa"];
