import { normalizarBusca } from "@/lib/formato";
import { SITUACOES } from "@/lib/situacoes";

/**
 * Filtros da lista de Propostas e contratos. Tudo vive na URL (?q=...&situacao=...),
 * para que uma busca possa ser compartilhada como link.
 */
export type FiltrosRegistros = {
  q: string;
  situacao: string; // uma das SITUACOES, "sem" (sem situação) ou ""
  atalho: "" | "contratos" | "aguardando" | "litigio";
  anoDe: number | null;
  anoAte: number | null;
  setor: string;
  area: string;
  gerente: string;
  entidade: string;
  tipo: "" | "P" | "T";
  ordem: ColunaOrdem;
  dir: "asc" | "desc";
  pagina: number;
};

export const COLUNAS_ORDEM = {
  num: "num",
  cliente: "cliente",
  area: "area",
  data: "data_ini",
  situacao: "situacao",
  valor: "valor",
  ano: "ano",
} as const;
export type ColunaOrdem = keyof typeof COLUNAS_ORDEM;

export const POR_PAGINA = 50;

type Params = Record<string, string | string[] | undefined>;

function texto(p: Params, chave: string): string {
  const v = p[chave];
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";
}

function ano(p: Params, chave: string): number | null {
  const n = Number(texto(p, chave));
  return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : null;
}

export function lerFiltros(p: Params): FiltrosRegistros {
  const situacao = texto(p, "situacao");
  const atalho = texto(p, "atalho");
  const ordem = texto(p, "ordem");
  const tipo = texto(p, "tipo");
  const pagina = Number(texto(p, "pagina"));
  return {
    q: texto(p, "q"),
    situacao: situacao === "sem" || (SITUACOES as readonly string[]).includes(situacao) ? situacao : "",
    atalho: atalho === "contratos" || atalho === "aguardando" || atalho === "litigio" ? atalho : "",
    anoDe: ano(p, "de"),
    anoAte: ano(p, "ate"),
    setor: texto(p, "setor"),
    area: texto(p, "area"),
    gerente: texto(p, "gerente"),
    entidade: texto(p, "entidade"),
    tipo: tipo === "P" || tipo === "T" ? tipo : "",
    ordem: ordem in COLUNAS_ORDEM ? (ordem as ColunaOrdem) : "num",
    dir: texto(p, "dir") === "asc" ? "asc" : texto(p, "dir") === "desc" ? "desc" : ordem ? "asc" : "desc",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Monta a query string a partir dos filtros (omitindo os vazios), com alterações opcionais. */
export function paraURL(f: FiltrosRegistros, mudar: Partial<FiltrosRegistros> = {}): string {
  const g = { ...f, ...mudar };
  const u = new URLSearchParams();
  if (g.q) u.set("q", g.q);
  if (g.situacao) u.set("situacao", g.situacao);
  if (g.atalho) u.set("atalho", g.atalho);
  if (g.anoDe) u.set("de", String(g.anoDe));
  if (g.anoAte) u.set("ate", String(g.anoAte));
  if (g.setor) u.set("setor", g.setor);
  if (g.area) u.set("area", g.area);
  if (g.gerente) u.set("gerente", g.gerente);
  if (g.entidade) u.set("entidade", g.entidade);
  if (g.tipo) u.set("tipo", g.tipo);
  if (g.ordem !== "num" || g.dir !== "desc") {
    u.set("ordem", g.ordem);
    u.set("dir", g.dir);
  }
  if (g.pagina > 1) u.set("pagina", String(g.pagina));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function temFiltro(f: FiltrosRegistros): boolean {
  return Boolean(f.q || f.situacao || f.atalho || f.anoDe || f.anoAte || f.setor || f.area || f.gerente || f.entidade || f.tipo);
}

/** Palavras da busca, normalizadas como a coluna `busca` do banco, com curingas escapados. */
export function termosBusca(q: string): string[] {
  return normalizarBusca(q)
    .split(" ")
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => t.replace(/[\\%_]/g, (c) => `\\${c}`));
}

// Estrutura mínima do query builder do supabase-js que usamos. Tipada de forma
// estrutural (e não com os genéricos do supabase-js) para não estourar o compilador.
type Consulta = {
  ilike(coluna: string, padrao: string): Consulta;
  eq(coluna: string, valor: unknown): Consulta;
  is(coluna: string, valor: null): Consulta;
  gte(coluna: string, valor: unknown): Consulta;
  lte(coluna: string, valor: unknown): Consulta;
};

/** Aplica os filtros a uma consulta em vw_registros (devolve a mesma consulta, filtrada). */
export function aplicarFiltros<T>(consulta: T, f: FiltrosRegistros): T {
  let c = consulta as unknown as Consulta;
  for (const termo of termosBusca(f.q)) c = c.ilike("busca", `%${termo}%`);
  if (f.situacao === "sem") c = c.is("situacao", null);
  else if (f.situacao) c = c.eq("situacao", f.situacao);
  if (f.atalho === "contratos") c = c.eq("contrato_total", true);
  if (f.atalho === "aguardando") c = c.eq("situacao", "Proposta colocada");
  if (f.atalho === "litigio") c = c.eq("grupo", "litigio");
  if (f.anoDe) c = c.gte("ano", f.anoDe);
  if (f.anoAte) c = c.lte("ano", f.anoAte);
  if (f.setor) c = c.eq("setor", f.setor);
  if (f.area) c = c.eq("area", f.area);
  if (f.gerente) c = c.eq("gerente", f.gerente);
  if (f.entidade === "sem") c = c.is("entidade", null);
  else if (f.entidade) c = c.eq("entidade", f.entidade);
  if (f.tipo) c = c.eq("tipo", f.tipo);
  return c as unknown as T;
}

export const COLUNAS_LISTA =
  "num, cliente_id, cliente, empresa_original, gerente, escopo, situacao, grupo, contrato_total, data_ini, data_ini_texto, data_enc, data_enc_texto, tipo, valor, valor_texto, valor_vencedor, entidade, obs, ano, setor, area, empreendimento, servico, especialidade";
