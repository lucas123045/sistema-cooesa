import { describe, expect, it } from "vitest";
import {
  agregar,
  agregarPor,
  concentracao,
  diferencaPontos,
  situacaoCreditos,
  variacao,
  type NotaResultado,
  type RegistroResultado,
} from "@/lib/resultados";

const reg = (p: Partial<RegistroResultado>): RegistroResultado => ({
  num: 1,
  cliente_id: 1,
  cliente: "A",
  situacao: "Proposta colocada - negativa",
  contrato_total: false,
  tipo: "P",
  valor: null,
  ano: 2024,
  area: null,
  setor: null,
  gerente: null,
  ...p,
});

describe("agregar", () => {
  const linhas = [
    reg({ valor: 1_000_000 }),
    reg({ valor: 100_000, contrato_total: true }),
    reg({ valor: "50000", contrato_total: true }),
    reg({ valor: null, contrato_total: true }), // contrato sem valor: conta na quantidade, não no valor
    reg({ tipo: "T", valor: 20_000, contrato_total: true }), // mensal: nunca entra nas somas de P
  ];
  const a = agregar(linhas);

  it("taxa por quantidade = contratos ÷ propostas", () => {
    expect(a.propostas).toBe(5);
    expect(a.contratos).toBe(4);
    expect(a.taxaQuantidade).toBeCloseTo(80);
  });

  it("taxa por valor usa só P com valor numérico", () => {
    expect(a.propostoP).toBe(1_150_000);
    expect(a.contratadoP).toBe(150_000);
    expect(a.taxaValor).toBeCloseTo(13.04, 2);
  });

  it("ticket médio de P e T mensal separado", () => {
    expect(a.ticketPropostoP).toBeCloseTo(383_333.33, 2);
    expect(a.ticketContratadoP).toBe(75_000);
    expect(a.contratadoTMensal).toBe(20_000);
  });

  it("sem propostas não divide por zero", () => {
    expect(agregar([]).taxaQuantidade).toBeNull();
    expect(agregar([]).taxaValor).toBeNull();
  });
});

describe("agregarPor", () => {
  it("agrupa vazios em “Sem classificação”", () => {
    const g = agregarPor([reg({ area: "Geração" }), reg({ area: null }), reg({ area: "Geração", contrato_total: true })], (r) => r.area);
    const porChave = Object.fromEntries(g.map((x) => [x.chave, x.dados.propostas]));
    expect(porChave).toEqual({ Geração: 2, "Sem classificação": 1 });
  });
});

describe("concentracao", () => {
  it("ordena, soma por cliente e acumula a participação", () => {
    const c = concentracao([
      { clienteId: 1, cliente: "A", valor: 60 },
      { clienteId: 2, cliente: "B", valor: 30 },
      { clienteId: 1, cliente: "A", valor: 0 },
      { clienteId: 3, cliente: "C", valor: 10 },
    ]);
    expect(c.total).toBe(100);
    expect(c.ranking.map((r) => [r.cliente, r.participacao, r.acumulada])).toEqual([
      ["A", 60, 60],
      ["B", 30, 90],
      ["C", 10, 100],
    ]);
    expect(c.top5).toBe(100);
  });
});

describe("situacaoCreditos", () => {
  it("separa pendente de verdade de nota sem dados", () => {
    const n = (p: Partial<NotaResultado>): NotaResultado => ({ ano: 2024, valor: 100, data_emissao: "2024-01-01", data_credito: null, cliente_id: 1, cliente: "A", ...p });
    const s = situacaoCreditos([n({ data_credito: "2024-02-01" }), n({}), n({ data_emissao: null, valor: 50 })]);
    expect(s).toMatchObject({ creditado: 100, semCredito: 100, qtdSemCredito: 1, semDados: 50, qtdSemDados: 1, total: 250 });
  });
});

describe("comparativos", () => {
  it("variação % e diferença em pontos", () => {
    expect(variacao(120, 100)).toBeCloseTo(20);
    expect(variacao(10, 0)).toBeNull();
    expect(diferencaPontos(20, 17.5)).toBeCloseTo(2.5);
  });
});
