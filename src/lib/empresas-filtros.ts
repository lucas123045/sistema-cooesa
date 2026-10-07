import { termosBusca } from "@/lib/registros/filtros";
import { STATUS_EMPRESA, UFS } from "@/lib/empresas";

/** Filtros da lista de Empresas — vivem na URL para poderem ser compartilhados. */
export type FiltrosEmpresas = {
  q: string;
  /** Um dos STATUS_EMPRESA, "sem" (ainda sem status) ou "" (todos). */
  status: string;
  setor: string;
  uf: string;
  responsavel: string;
  ordem: ColunaEmpresa;
  dir: "asc" | "desc";
  pagina: number;
};

export const COLUNAS_EMPRESA = {
  nome: "nome",
  status: "status",
  local: "cidade",
  propostas: "propostas",
  contratos: "contratos",
  contratado: "valor_contratado_p",
  ultima: "ultima_proposta",
} as const;
export type ColunaEmpresa = keyof typeof COLUNAS_EMPRESA;

export const POR_PAGINA_EMPRESAS = 50;

type Params = Record<string, string | string[] | undefined>;
const texto = (p: Params, k: string) => (Array.isArray(p[k]) ? p[k][0] : p[k])?.trim().slice(0, 120) ?? "";

export function lerFiltrosEmpresas(p: Params): FiltrosEmpresas {
  const status = texto(p, "status");
  const uf = texto(p, "uf").toUpperCase();
  const ordem = texto(p, "ordem");
  const dir = texto(p, "dir");
  const pagina = Number(texto(p, "pagina"));
  const ordemValida: ColunaEmpresa = ordem in COLUNAS_EMPRESA ? (ordem as ColunaEmpresa) : "nome";
  return {
    q: texto(p, "q"),
    status: status === "sem" || (STATUS_EMPRESA as readonly string[]).includes(status) ? status : "",
    setor: texto(p, "setor"),
    uf: (UFS as readonly string[]).includes(uf) ? uf : "",
    responsavel: texto(p, "responsavel"),
    ordem: ordemValida,
    // Nome em ordem alfabética; números e datas, do maior para o menor.
    dir: dir === "asc" || dir === "desc" ? dir : ordemValida === "nome" || ordemValida === "local" ? "asc" : "desc",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

export function paraURLEmpresas(f: FiltrosEmpresas, mudar: Partial<FiltrosEmpresas> = {}): string {
  const g = { ...f, ...mudar };
  const u = new URLSearchParams();
  if (g.q) u.set("q", g.q);
  if (g.status) u.set("status", g.status);
  if (g.setor) u.set("setor", g.setor);
  if (g.uf) u.set("uf", g.uf);
  if (g.responsavel) u.set("responsavel", g.responsavel);
  if (g.ordem !== "nome") u.set("ordem", g.ordem);
  if (g.ordem !== "nome" || g.dir !== "asc") u.set("dir", g.dir);
  if (g.pagina > 1) u.set("pagina", String(g.pagina));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function temFiltroEmpresas(f: FiltrosEmpresas): boolean {
  return Boolean(f.q || f.status || f.setor || f.uf || f.responsavel);
}

type Consulta = {
  ilike(coluna: string, padrao: string): Consulta;
  eq(coluna: string, valor: unknown): Consulta;
  is(coluna: string, valor: null): Consulta;
};

/** Aplica os filtros a uma consulta em vw_clientes (mesma consulta da lista e da exportação). */
export function aplicarFiltrosEmpresas<T>(consulta: T, f: FiltrosEmpresas): T {
  let c = consulta as unknown as Consulta;
  for (const termo of termosBusca(f.q)) c = c.ilike("busca", `%${termo}%`);
  if (f.status === "sem") c = c.is("status", null);
  else if (f.status) c = c.eq("status", f.status);
  if (f.setor) c = c.eq("setor", f.setor);
  if (f.uf) c = c.eq("uf", f.uf);
  if (f.responsavel) c = c.eq("responsavel", f.responsavel);
  return c as unknown as T;
}
