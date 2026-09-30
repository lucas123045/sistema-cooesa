import Link from "next/link";

type CabecalhoOrdenavelProps = {
  rotulo: string;
  coluna: string;
  ordemAtual: string;
  dirAtual: "asc" | "desc";
  href: (coluna: string, dir: "asc" | "desc") => string;
  numerico?: boolean;
  className?: string;
};

/** <th> com link de ordenação e aria-sort. */
export function CabecalhoOrdenavel({ rotulo, coluna, ordemAtual, dirAtual, href, numerico, className }: CabecalhoOrdenavelProps) {
  const ativa = ordemAtual === coluna;
  const proxima: "asc" | "desc" = ativa && dirAtual === "asc" ? "desc" : "asc";
  const seta = ativa ? (dirAtual === "asc" ? " ▲" : " ▼") : "";
  return (
    <th
      scope="col"
      className={[numerico ? "num" : "", className ?? ""].join(" ").trim() || undefined}
      aria-sort={ativa ? (dirAtual === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link href={href(coluna, proxima)} scroll={false}>
        {rotulo}
        {seta}
      </Link>
    </th>
  );
}

type PaginacaoProps = {
  pagina: number;
  porPagina: number;
  total: number;
  href: (pagina: number) => string;
};

export function Paginacao({ pagina, porPagina, total, href }: PaginacaoProps) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  const fmt = new Intl.NumberFormat("pt-BR");
  return (
    <div className="paginacao">
      <span>
        {fmt.format(inicio)}–{fmt.format(fim)} de {fmt.format(total)}
      </span>
      <nav aria-label="Paginação">
        {pagina > 1 ? (
          <Link className="btn btn-pequeno" href={href(pagina - 1)}>
            ← Anterior
          </Link>
        ) : (
          <span className="btn btn-pequeno" aria-disabled="true">
            ← Anterior
          </span>
        )}
        <span className="btn btn-pequeno" aria-current="page">
          {pagina} / {paginas}
        </span>
        {pagina < paginas ? (
          <Link className="btn btn-pequeno" href={href(pagina + 1)}>
            Próxima →
          </Link>
        ) : (
          <span className="btn btn-pequeno" aria-disabled="true">
            Próxima →
          </span>
        )}
      </nav>
    </div>
  );
}
