/**
 * Indicadores da tela Resultados, calculados a partir das linhas de vw_registros e vw_notas.
 * Funções puras (sem banco) para poderem ser testadas.
 *
 * Regras:
 * - "Contrato" = encerrado + em andamento (definição da empresa; litígio não conta).
 * - Valores em R$ só com tipo P (valor total). T é mensal e nunca é somado a P.
 * - Taxa de sucesso por valor = contratado P ÷ proposto P, só entre propostas P com valor numérico.
 */

export type RegistroResultado = {
  num: number;
  cliente_id: number;
  cliente: string;
  situacao: string | null;
  contrato_total: boolean;
  tipo: "P" | "T";
  valor: number | string | null;
  ano: number;
  area: string | null;
  setor: string | null;
  gerente: string | null;
};

export type NotaResultado = {
  ano: number;
  valor: number | string;
  data_emissao: string | null;
  data_credito: string | null;
  cliente_id: number | null;
  cliente: string | null;
};

export type Agregado = {
  propostas: number;
  contratos: number;
  /** % por quantidade (contratos ÷ propostas). */
  taxaQuantidade: number | null;
  propostoP: number;
  contratadoP: number;
  /** % por valor (contratado P ÷ proposto P). */
  taxaValor: number | null;
  ticketPropostoP: number | null;
  ticketContratadoP: number | null;
  contratadoTMensal: number;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
const centavos = (v: number) => Math.round(v * 100) / 100;

export function agregar(linhas: readonly RegistroResultado[]): Agregado {
  let contratos = 0;
  let propostoP = 0;
  let contratadoP = 0;
  let qtdPropostoP = 0;
  let qtdContratadoP = 0;
  let contratadoT = 0;
  for (const r of linhas) {
    const v = num(r.valor);
    if (r.contrato_total) contratos++;
    if (r.tipo === "P" && v !== null) {
      propostoP += v;
      qtdPropostoP++;
      if (r.contrato_total) {
        contratadoP += v;
        qtdContratadoP++;
      }
    }
    if (r.tipo === "T" && v !== null && r.contrato_total) contratadoT += v;
  }
  return {
    propostas: linhas.length,
    contratos,
    taxaQuantidade: linhas.length ? (contratos / linhas.length) * 100 : null,
    propostoP: centavos(propostoP),
    contratadoP: centavos(contratadoP),
    taxaValor: propostoP > 0 ? (contratadoP / propostoP) * 100 : null,
    ticketPropostoP: qtdPropostoP ? centavos(propostoP / qtdPropostoP) : null,
    ticketContratadoP: qtdContratadoP ? centavos(contratadoP / qtdContratadoP) : null,
    contratadoTMensal: centavos(contratadoT),
  };
}

/** Agrupa e agrega por uma chave (área, setor, gerente, ano…). Vazio vira "Sem classificação". */
export function agregarPor<K extends string | number>(
  linhas: readonly RegistroResultado[],
  chave: (r: RegistroResultado) => K | null,
  rotuloVazio = "Sem classificação",
): { chave: K | string; dados: Agregado }[] {
  const grupos = new Map<K | string, RegistroResultado[]>();
  for (const r of linhas) {
    const k = chave(r) ?? rotuloVazio;
    const lista = grupos.get(k);
    if (lista) lista.push(r);
    else grupos.set(k, [r]);
  }
  return [...grupos].map(([k, l]) => ({ chave: k, dados: agregar(l) }));
}

export type ParticipacaoCliente = { clienteId: number; cliente: string; valor: number; participacao: number; acumulada: number };

/** Participação de cada cliente num total (maior primeiro), com a participação acumulada. */
export function concentracao(itens: readonly { clienteId: number; cliente: string; valor: number }[]): {
  total: number;
  ranking: ParticipacaoCliente[];
  top5: number;
  top10: number;
} {
  const porCliente = new Map<number, { cliente: string; valor: number }>();
  for (const i of itens) {
    const atual = porCliente.get(i.clienteId);
    if (atual) atual.valor += i.valor;
    else porCliente.set(i.clienteId, { cliente: i.cliente, valor: i.valor });
  }
  const total = [...porCliente.values()].reduce((s, c) => s + c.valor, 0);
  let acumulada = 0;
  const ranking = [...porCliente]
    .filter(([, c]) => c.valor > 0)
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([clienteId, c]) => {
      const participacao = total ? (c.valor / total) * 100 : 0;
      acumulada += participacao;
      return { clienteId, cliente: c.cliente, valor: centavos(c.valor), participacao, acumulada };
    });
  return {
    total: centavos(total),
    ranking,
    top5: ranking[Math.min(4, ranking.length - 1)]?.acumulada ?? 0,
    top10: ranking[Math.min(9, ranking.length - 1)]?.acumulada ?? 0,
  };
}

/** Contratado P por cliente (para a concentração da carteira). */
export function contratadoPorCliente(linhas: readonly RegistroResultado[]) {
  return concentracao(
    linhas
      .filter((r) => r.contrato_total && r.tipo === "P" && num(r.valor) !== null)
      .map((r) => ({ clienteId: r.cliente_id, cliente: r.cliente, valor: Number(r.valor) })),
  );
}

/** Faturado por cliente (notas ligadas a um cliente cadastrado). */
export function faturadoPorCliente(notas: readonly NotaResultado[]) {
  return concentracao(
    notas
      .filter((n) => n.cliente_id !== null)
      .map((n) => ({ clienteId: n.cliente_id as number, cliente: n.cliente ?? "—", valor: Number(n.valor) })),
  );
}

/**
 * Situação dos créditos das notas. Separa o que realmente pode estar pendente
 * (emitida, sem crédito) do que é só falta de dado (sem data de emissão).
 */
export function situacaoCreditos(notas: readonly NotaResultado[]) {
  const r = { creditado: 0, semCredito: 0, qtdSemCredito: 0, semDados: 0, qtdSemDados: 0, total: 0 };
  for (const n of notas) {
    const v = Number(n.valor);
    r.total += v;
    if (n.data_credito) r.creditado += v;
    else if (n.data_emissao) {
      r.semCredito += v;
      r.qtdSemCredito++;
    } else {
      r.semDados += v;
      r.qtdSemDados++;
    }
  }
  return {
    ...r,
    creditado: centavos(r.creditado),
    semCredito: centavos(r.semCredito),
    semDados: centavos(r.semDados),
    total: centavos(r.total),
  };
}

/** Variação percentual (null quando não há base de comparação). */
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Diferença em pontos percentuais, para comparar taxas. */
export function diferencaPontos(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null) return null;
  return atual - anterior;
}
