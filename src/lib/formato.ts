/** Formatação no padrão brasileiro. Nada aqui depende do fuso do servidor. */

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return moeda.format(Number(valor));
}

export function formatarMoedaCompacta(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return moedaCompacta.format(Number(valor));
}

export function formatarInteiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return inteiro.format(Number(valor));
}

/** Percentual a partir de um número já em pontos percentuais (ex.: 32.1 → "32,1%"). */
export function formatarPercentual(pontos: number | null | undefined): string {
  if (pontos === null || pontos === undefined || Number.isNaN(Number(pontos))) return "—";
  return `${decimal1.format(Number(pontos))}%`;
}

/** "2024-07-15" → "15/07/2024". Trabalha só com a string, sem fuso horário. */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Data e hora de um timestamptz, no fuso de São Paulo. */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Valor de um registro, com a indicação "/mês" quando o tipo é T. */
export function formatarValorRegistro(valor: number | null, tipo: string | null, valorTexto?: string | null): string {
  if (valor === null || valor === undefined) return valorTexto ? `“${valorTexto}”` : "—";
  return tipo === "T" ? `${formatarMoeda(valor)}/mês` : formatarMoeda(valor);
}

/** Remove acentos e passa para minúsculas — mesma normalização da coluna de busca no banco. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Autor de uma alteração no histórico, legível ("sistema (postgres)" vira "Sistema (correção em lote)"). */
export function rotuloUsuario(usuario: string): string {
  return /^sistema \(/i.test(usuario) ? "Sistema (correção em lote)" : usuario;
}

/** Primeira letra maiúscula ("quarta-feira" → "Quarta-feira"). */
export function capitalizar(texto: string): string {
  return texto ? texto[0].toLocaleUpperCase("pt-BR") + texto.slice(1) : texto;
}
