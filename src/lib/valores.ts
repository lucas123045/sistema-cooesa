/**
 * Conversão de valores digitados no padrão brasileiro.
 *   "1.234,56" → 1234.56   "R$ 15.000" → 15000   "1234.5" → 1234.5   "" → null
 * Retorna NaN quando o texto não é um número reconhecível.
 */
export function lerValorBR(texto: string | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  let s = String(texto).replace(/R\$/gi, "").replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) {
    // vírgula é o separador decimal: pontos são de milhar
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "15.000" ou "1.234.567": pontos de milhar, sem decimais
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  const n = Number(s);
  return Math.round(n * 100) / 100;
}

/** Número → texto para campo de formulário ("1234.5" → "1.234,50"). */
export function valorParaCampo(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(valor));
}
