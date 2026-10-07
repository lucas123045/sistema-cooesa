import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj, STATUS_EMPRESA, UFS, urlSite } from "@/lib/empresas";

const migracao = readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", "20261008120000_cadastro_empresas.sql"),
  "utf8",
);
const valoresDoCheck = (nome: string) => {
  const bloco = new RegExp(String.raw`constraint ${nome} check \(([\s\S]*?)\)\s*\)`).exec(migracao);
  return [...(bloco?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

describe("empresas: TypeScript igual ao banco", () => {
  it("mesmos 5 status", () => {
    expect([...valoresDoCheck("clientes_status_valido")].sort()).toEqual([...STATUS_EMPRESA].sort());
  });
  it("mesmas 27 UFs", () => {
    expect([...valoresDoCheck("clientes_uf_valida")].sort()).toEqual([...UFS].sort());
  });
});

describe("CNPJ", () => {
  it("aceita com ou sem pontuação e recusa dígito errado, repetido ou curto", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11444777000161")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
  });
  it("formata para exibição", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj(null)).toBe("");
  });
  it("site ganha https:// quando falta", () => {
    expect(urlSite("cooesa.com.br")).toBe("https://cooesa.com.br");
    expect(urlSite("http://x.com")).toBe("http://x.com");
  });
});

describe("formulário de empresa", () => {
  const base = {
    nome: "  nova   empresa ltda ",
    razao_social: "",
    cnpj: "11.222.333/0001-81",
    status: "Prospecção",
    setor: "",
    cidade: "São Paulo",
    uf: "sp",
    site: "",
    responsavel: "",
    origem: "",
    observacoes: "",
  };

  it("normaliza nome, guarda CNPJ só com dígitos e UF em maiúsculas; vazio vira nulo", async () => {
    const { esquemaEmpresa } = await import("@/lib/empresas-esquema");
    const r = esquemaEmpresa.parse(base);
    expect(r).toMatchObject({ nome: "NOVA EMPRESA LTDA", cnpj: "11222333000181", uf: "SP", razao_social: null, site: null });
  });

  it("recusa CNPJ inválido, UF inexistente, status fora da lista e nome vazio", async () => {
    const { esquemaEmpresa } = await import("@/lib/empresas-esquema");
    const erros = (dados: Partial<typeof base>) =>
      esquemaEmpresa.safeParse({ ...base, ...dados }).error?.issues.map((i) => i.path[0]) ?? [];
    expect(erros({ cnpj: "11.222.333/0001-82" })).toEqual(["cnpj"]);
    expect(erros({ uf: "XX" })).toEqual(["uf"]);
    expect(erros({ status: "Ótimo" })).toEqual(["status"]);
    expect(erros({ nome: " " })).toEqual(["nome"]);
    expect(erros({ cnpj: "" })).toEqual([]);
  });
});
