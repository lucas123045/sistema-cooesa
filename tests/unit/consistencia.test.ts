import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { gerarCSV, gerarXLSX } from "@/lib/exportar";
import { hojeBrasil } from "@/lib/formato";
import { SITUACOES } from "@/lib/situacoes";

describe("vocabulário de situações", () => {
  it("o TypeScript e a regra do banco têm exatamente as mesmas 7 situações", () => {
    const sql = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20260930130000_esquema_base.sql"), "utf8");
    const bloco = /constraint registros_situacao_valida check \(\s*situacao in \(([\s\S]*?)\)\s*\)/.exec(sql);
    expect(bloco).not.toBeNull();
    const doBanco = [...bloco![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...doBanco].sort()).toEqual([...SITUACOES].sort());
  });
});

describe("data de Brasília", () => {
  it("na virada do ano o servidor (UTC) já está em janeiro, Brasília ainda não", () => {
    const h = hojeBrasil(new Date("2027-01-01T01:30:00Z")); // 22h30 de 31/12 em Brasília
    expect(h).toEqual({ ano: 2026, mes: 12, dia: 31, iso: "2026-12-31" });
  });
});

describe("exportação", () => {
  type Linha = { nome: string; valor: number | null; data: string | null };
  const colunas = [
    { titulo: "Nome", valor: (l: Linha) => l.nome },
    { titulo: "Valor", valor: (l: Linha) => l.valor, tipo: "moeda" as const },
    { titulo: "Data", valor: (l: Linha) => l.data, tipo: "data" as const },
  ];
  const linhas: Linha[] = [
    { nome: 'DALL\'ACQUA; "Saneamento"', valor: 1234.5, data: "2024-07-15" },
    { nome: "SEM VALOR", valor: null, data: null },
  ];

  it("CSV no formato do Excel brasileiro (BOM, ponto e vírgula, vírgula decimal, aspas)", () => {
    const csv = gerarCSV(colunas, linhas);
    expect(csv.startsWith("\ufeffNome;Valor;Data\r\n")).toBe(true);
    expect(csv).toContain('"DALL\'ACQUA; ""Saneamento""";1234,5;2024-07-15');
    expect(csv).toContain("SEM VALOR;;\r\n");
  });

  it("Excel abre, tem cabeçalho, número como número e data como data", async () => {
    const buf = await gerarXLSX([{ nome: "Teste", colunas, linhas, titulo: "Cooesa", subtitulo: "teste" }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Teste")!;
    expect(ws.getRow(4).values).toEqual([undefined, "Nome", "Valor", "Data"]);
    expect(ws.getRow(5).getCell(2).value).toBe(1234.5);
    expect(ws.getRow(5).getCell(3).value).toBeInstanceOf(Date);
    expect(ws.getRow(6).getCell(2).value).toBeNull();
  });
});
