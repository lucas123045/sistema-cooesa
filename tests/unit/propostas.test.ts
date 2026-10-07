import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caracteristicasDaArea, CAMPOS_TECNICOS, esquemaTecnico, MODALIDADES, MOTIVOS_PERDA } from "@/lib/propostas";

const migracao = readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", "20261009120000_cadastro_propostas.sql"),
  "utf8",
);
const valoresDoCheck = (nome: string) => {
  const bloco = new RegExp(String.raw`constraint ${nome} check \(([\s\S]*?)\)\s*\)`).exec(migracao);
  return [...(bloco?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
};
const vazio = Object.fromEntries(CAMPOS_TECNICOS.map((c) => [c, ""]));

describe("propostas: TypeScript igual ao banco", () => {
  it("mesmas modalidades e motivos de perda", () => {
    expect([...valoresDoCheck("registros_modalidade_valida")].sort()).toEqual([...MODALIDADES].sort());
    expect([...valoresDoCheck("registros_motivo_perda_valido")].sort()).toEqual([...MOTIVOS_PERDA].sort());
  });
  it("todo campo técnico existe na migração", () => {
    for (const c of CAMPOS_TECNICOS) expect(migracao).toContain(`add column ${c} `);
  });
});

describe("dados técnicos", () => {
  it("tudo vazio é válido (campos opcionais) e revisão vazia vira R0", () => {
    const r = esquemaTecnico.parse(vazio);
    expect(r.revisao).toBe(0);
    expect(r.potencia_mw).toBeNull();
    expect(r.modalidade).toBeNull();
  });
  it("aceita números no formato brasileiro e revisão como R2", () => {
    const r = esquemaTecnico.parse({
      ...vazio,
      potencia_mw: "1.540,5",
      tensao_kv: "138",
      extensao_km: "32,0",
      revisao: "R2",
      local_uf: "sp",
    });
    expect(r).toMatchObject({ potencia_mw: 1540.5, tensao_kv: 138, extensao_km: 32, revisao: 2, local_uf: "SP" });
  });
  it("recusa negativos, texto em número, horas fracionadas e vocabulário desconhecido", () => {
    const erros = (d: Record<string, string>) =>
      esquemaTecnico.safeParse({ ...vazio, ...d }).error?.issues.map((i) => i.path[0]) ?? [];
    expect(erros({ potencia_mw: "-5" })).toEqual(["potencia_mw"]);
    expect(erros({ tensao_kv: "alta" })).toEqual(["tensao_kv"]);
    expect(erros({ horas_estimadas: "10,5" })).toEqual(["horas_estimadas"]);
    expect(erros({ modalidade: "Pregão" })).toEqual(["modalidade"]);
    expect(erros({ motivo_perda: "Azar" })).toEqual(["motivo_perda"]);
  });
  it("características conforme a área", () => {
    expect(caracteristicasDaArea("Geração")).toEqual({ potencia: true, tensao: true, extensao: false });
    expect(caracteristicasDaArea("Transmissão")).toEqual({ potencia: false, tensao: true, extensao: true });
    expect(caracteristicasDaArea("Abastecimento")).toEqual({ potencia: false, tensao: false, extensao: false });
  });
});
