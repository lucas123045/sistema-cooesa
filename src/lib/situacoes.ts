/**
 * Vocabulário fixo das situações (seção 4.3). Os textos são exatamente os da
 * planilha e do banco — não altere a grafia.
 */
export const SITUACOES = [
  "Proposta colocada",
  "Proposta colocada - negativa",
  "Proposta cancelada",
  "Proposta em litígio",
  "Contrato em andamento",
  "Contrato encerrado",
  "Contrato em litígio",
] as const;

export type Situacao = (typeof SITUACOES)[number];

export type GrupoSituacao = "aguardando" | "perdida" | "cancelada" | "litigio" | "contrato";

export const GRUPO_SITUACAO: Record<Situacao, GrupoSituacao> = {
  "Proposta colocada": "aguardando",
  "Proposta colocada - negativa": "perdida",
  "Proposta cancelada": "cancelada",
  "Proposta em litígio": "litigio",
  "Contrato em andamento": "contrato",
  "Contrato encerrado": "contrato",
  "Contrato em litígio": "litigio",
};

export const ROTULO_GRUPO: Record<GrupoSituacao, string> = {
  aguardando: "Aguardando resposta",
  perdida: "Perdida",
  cancelada: "Cancelada",
  litigio: "Litígio",
  contrato: "Contrato",
};

/**
 * "Contratos totais" na definição da empresa: encerrados + em andamento.
 * "Contrato em litígio" NÃO entra (fica no grupo Litígio).
 */
export const SITUACOES_CONTRATO_TOTAL: readonly Situacao[] = ["Contrato encerrado", "Contrato em andamento"];

export function eSituacao(valor: unknown): valor is Situacao {
  return typeof valor === "string" && (SITUACOES as readonly string[]).includes(valor);
}

export function grupoDe(situacao: string | null | undefined): GrupoSituacao | null {
  return eSituacao(situacao) ? GRUPO_SITUACAO[situacao] : null;
}

/** % de sucesso das cotações = contratos totais ÷ total de propostas, em pontos percentuais. */
export function percentualSucesso(contratosTotais: number, totalPropostas: number): number | null {
  if (!totalPropostas) return null;
  return (contratosTotais / totalPropostas) * 100;
}

/** Conta contratos totais numa lista de situações (mesma regra da vw_resumo). */
export function contarContratosTotais(situacoes: readonly (string | null | undefined)[]): number {
  return situacoes.filter((s) => s != null && (SITUACOES_CONTRATO_TOTAL as readonly string[]).includes(s)).length;
}

/** Soma valores separando P (valor total) de T (valor mensal). Nunca misture os dois. */
export function somarPorTipo(itens: readonly { tipo: string | null; valor: number | null }[]): { P: number; T: number } {
  const total = { P: 0, T: 0 };
  for (const item of itens) {
    if (item.valor === null || item.valor === undefined) continue;
    if (item.tipo === "P") total.P += Number(item.valor);
    else if (item.tipo === "T") total.T += Number(item.valor);
  }
  // arredonda em centavos para evitar resíduo de ponto flutuante
  return { P: Math.round(total.P * 100) / 100, T: Math.round(total.T * 100) / 100 };
}
