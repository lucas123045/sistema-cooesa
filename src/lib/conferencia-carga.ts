/**
 * Números de validação da carga (seção 4.6 do docs/PROMPT.md).
 * A carga só está correta se todos baterem. Usado por scripts/seed.ts e pelos testes.
 */

export type DadosConferencia = {
  resumo: {
    total_propostas: number;
    contratos_totais: number;
    pct_sucesso: number | string;
    clientes_distintos: number;
    clientes_contrataram: number;
    tipo_p: number;
    tipo_t: number;
    valor_total_registros: number | string;
    valor_contratado_p: number | string;
    valor_contratado_t_mensal: number | string;
  };
  situacoes: { situacao: string | null; quantidade: number }[];
  faturamentoAnual: { ano: number; quantidade: number; total: number | string }[];
  acompanhamentos: { vinculados: number; nao_vinculados: number };
};

export type ItemConferencia = { item: string; esperado: string; obtido: string; ok: boolean };

export const ESPERADO = {
  registros: 1059,
  situacoes: {
    "Proposta colocada": 9,
    "Proposta colocada - negativa": 688,
    "Proposta cancelada": 16,
    "Proposta em litígio": 0,
    "Contrato em andamento": 6,
    "Contrato encerrado": 334,
    "Contrato em litígio": 5,
    "(sem situação)": 1,
  } as Record<string, number>,
  contratosTotais: 340,
  pctSucesso: "32,1%",
  clientesDistintos: 332,
  clientesContrataram: 125,
  tipoP: 1006,
  tipoT: 53,
  somaValor: 343_681_860.64,
  contratadoP: 18_323_010.38,
  contratadoT: 1_621_240.0,
  notas: 121,
  totalNotas: 1_720_180.38,
  notasPorAno: {
    2020: 661_105.37,
    2021: 607_569.56,
    2022: 220_926.16,
    2023: 108_791.79,
    2024: 121_787.5,
  } as Record<number, number>,
  acompanhamentosVinculados: 68,
  acompanhamentosNaoVinculados: 12,
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function centavos(v: number | string): number {
  return Math.round(Number(v) * 100);
}

export function conferirCarga(d: DadosConferencia): ItemConferencia[] {
  const itens: ItemConferencia[] = [];
  const inteiro = (item: string, esperado: number, obtido: number) =>
    itens.push({ item, esperado: String(esperado), obtido: String(obtido), ok: esperado === obtido });
  const dinheiro = (item: string, esperado: number, obtido: number | string) =>
    itens.push({
      item,
      esperado: moeda.format(esperado),
      obtido: moeda.format(Number(obtido)),
      ok: centavos(esperado) === centavos(obtido),
    });

  inteiro("Registros", ESPERADO.registros, d.resumo.total_propostas);

  const porSituacao = new Map(d.situacoes.map((s) => [s.situacao ?? "(sem situação)", s.quantidade]));
  for (const [situacao, qtd] of Object.entries(ESPERADO.situacoes)) {
    inteiro(`Situação: ${situacao}`, qtd, porSituacao.get(situacao) ?? 0);
  }
  const inesperadas = [...porSituacao.keys()].filter((s) => !(s in ESPERADO.situacoes));
  itens.push({
    item: "Situações fora do vocabulário",
    esperado: "nenhuma",
    obtido: inesperadas.length ? inesperadas.join(", ") : "nenhuma",
    ok: inesperadas.length === 0,
  });

  inteiro("Contratos totais (encerrados + em andamento)", ESPERADO.contratosTotais, d.resumo.contratos_totais);
  const pctObtido = `${pct.format(Number(d.resumo.pct_sucesso))}%`;
  itens.push({
    item: "% de sucesso das cotações",
    esperado: ESPERADO.pctSucesso,
    obtido: pctObtido,
    ok: pctObtido === ESPERADO.pctSucesso,
  });
  inteiro("Clientes distintos", ESPERADO.clientesDistintos, d.resumo.clientes_distintos);
  inteiro("Clientes que contrataram", ESPERADO.clientesContrataram, d.resumo.clientes_contrataram);
  inteiro("Registros tipo P", ESPERADO.tipoP, d.resumo.tipo_p);
  inteiro("Registros tipo T", ESPERADO.tipoT, d.resumo.tipo_t);
  dinheiro("Soma de valor de todos os registros", ESPERADO.somaValor, d.resumo.valor_total_registros);
  dinheiro("Valor contratado tipo P (total)", ESPERADO.contratadoP, d.resumo.valor_contratado_p);
  dinheiro("Valor contratado tipo T (mensal)", ESPERADO.contratadoT, d.resumo.valor_contratado_t_mensal);

  const qtdNotas = d.faturamentoAnual.reduce((s, a) => s + a.quantidade, 0);
  const totalNotas = d.faturamentoAnual.reduce((s, a) => s + centavos(a.total), 0) / 100;
  inteiro("Notas fiscais", ESPERADO.notas, qtdNotas);
  dinheiro("Total das notas", ESPERADO.totalNotas, totalNotas);
  const porAno = new Map(d.faturamentoAnual.map((a) => [Number(a.ano), a.total]));
  for (const [ano, total] of Object.entries(ESPERADO.notasPorAno)) {
    dinheiro(`Notas de ${ano}`, total, porAno.get(Number(ano)) ?? 0);
  }

  inteiro("Acompanhamentos vinculados", ESPERADO.acompanhamentosVinculados, d.acompanhamentos.vinculados);
  inteiro("Acompanhamentos não vinculados", ESPERADO.acompanhamentosNaoVinculados, d.acompanhamentos.nao_vinculados);
  return itens;
}

/** Tabela em texto para o terminal. */
export function formatarConferencia(itens: ItemConferencia[]): string {
  const l1 = Math.max(...itens.map((i) => i.item.length), 4);
  const l2 = Math.max(...itens.map((i) => i.esperado.length), 8);
  const l3 = Math.max(...itens.map((i) => i.obtido.length), 6);
  const linha = (a: string, b: string, c: string, d: string) => `${a.padEnd(l1)}  ${b.padStart(l2)}  ${c.padStart(l3)}  ${d}`;
  return [
    linha("Item", "Esperado", "Obtido", "Resultado"),
    "-".repeat(l1 + l2 + l3 + 16),
    ...itens.map((i) => linha(i.item, i.esperado, i.obtido, i.ok ? "OK" : "DIVERGENTE")),
  ].join("\n");
}
