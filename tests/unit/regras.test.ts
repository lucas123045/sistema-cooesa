import { describe, expect, it } from "vitest";
import {
  contarContratosTotais,
  grupoDe,
  percentualSucesso,
  SITUACOES,
  somarPorTipo,
} from "@/lib/situacoes";
import { formatarData, formatarMoeda, formatarPercentual, formatarValorRegistro, normalizarBusca } from "@/lib/formato";
import { conferirCarga, ESPERADO } from "@/lib/conferencia-carga";

describe("% de sucesso das cotações", () => {
  it("contratos totais = encerrados + em andamento (litígio não conta)", () => {
    const lista = ["Contrato encerrado", "Contrato em andamento", "Contrato em litígio", "Proposta colocada", null];
    expect(contarContratosTotais(lista)).toBe(2);
  });

  it("340 de 1.059 = 32,1%", () => {
    expect(formatarPercentual(percentualSucesso(340, 1059))).toBe("32,1%");
  });

  it("sem propostas não divide por zero", () => {
    expect(percentualSucesso(0, 0)).toBeNull();
  });
});

describe("soma separando P e T", () => {
  it("nunca mistura valor total (P) com valor mensal (T)", () => {
    const r = somarPorTipo([
      { tipo: "P", valor: 100.1 },
      { tipo: "P", valor: 200.2 },
      { tipo: "T", valor: 50 },
      { tipo: "T", valor: null },
    ]);
    expect(r).toEqual({ P: 300.3, T: 50 });
  });

  it("exibe /mês para tipo T", () => {
    expect(formatarValorRegistro(19600, "T")).toBe(`${formatarMoeda(19600)}/mês`);
    expect(formatarValorRegistro(19600, "P")).toBe(formatarMoeda(19600));
    expect(formatarValorRegistro(null, "P", "15 milhões")).toBe("“15 milhões”");
  });
});

describe("vocabulário de situações", () => {
  it("tem exatamente as 7 situações da planilha", () => {
    expect(SITUACOES).toHaveLength(7);
    expect(grupoDe("Proposta colocada - negativa")).toBe("perdida");
    expect(grupoDe("Contrato em litígio")).toBe("litigio");
    expect(grupoDe("Ganhou")).toBeNull();
  });
});

describe("formatação pt-BR", () => {
  it("datas dd/mm/aaaa sem depender de fuso", () => {
    expect(formatarData("2024-07-01")).toBe("01/07/2024");
    expect(formatarData(null)).toBe("—");
  });
  it("busca ignora acentos e maiúsculas", () => {
    expect(normalizarBusca("  Segurança   de BARRAGEM ")).toBe("seguranca de barragem");
  });
});

describe("conferência da carga", () => {
  it("aponta divergência quando um número não bate", () => {
    const itens = conferirCarga({
      resumo: {
        total_propostas: 1059,
        contratos_totais: 339,
        pct_sucesso: 32.01,
        clientes_distintos: 332,
        clientes_contrataram: 125,
        tipo_p: 1006,
        tipo_t: 53,
        valor_total_registros: ESPERADO.somaValor,
        valor_contratado_p: ESPERADO.contratadoP,
        valor_contratado_t_mensal: ESPERADO.contratadoT,
      },
      situacoes: Object.entries(ESPERADO.situacoes).map(([s, q]) => ({ situacao: s === "(sem situação)" ? null : s, quantidade: q })),
      faturamentoAnual: Object.entries(ESPERADO.notasPorAno).map(([ano, total], i) => ({ ano: Number(ano), total, quantidade: i === 0 ? 121 : 0 })),
      acompanhamentos: { vinculados: 68, nao_vinculados: 12 },
    });
    const divergentes = itens.filter((i) => !i.ok).map((i) => i.item);
    expect(divergentes).toEqual(["Contratos totais (encerrados + em andamento)", "% de sucesso das cotações"]);
  });
});
