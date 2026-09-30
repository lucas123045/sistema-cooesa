import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CabecalhoOrdenavel, Paginacao } from "@/components/tabela";
import { formatarInteiro, formatarMoeda, formatarPercentual } from "@/lib/formato";
import { termosBusca } from "@/lib/registros/filtros";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaCliente } from "@/lib/tipos";

export const metadata: Metadata = { title: "Clientes" };

const COLUNAS = {
  nome: "nome",
  propostas: "propostas",
  contratos: "contratos",
  sucesso: "pct_sucesso",
  contratado: "valor_contratado_p",
  faturado: "faturado",
  ultimo: "ultimo_ano",
} as const;
type Coluna = keyof typeof COLUNAS;
const POR_PAGINA = 50;

function texto(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";
}

export default async function PaginaClientes(props: PageProps<"/clientes">) {
  await exigirSessao();
  const p = await props.searchParams;
  const q = texto(p.q);
  const ordem: Coluna = texto(p.ordem) in COLUNAS ? (texto(p.ordem) as Coluna) : "nome";
  const dir = texto(p.dir) === "desc" || (!p.dir && ordem !== "nome") ? "desc" : "asc";
  const pagina = Math.max(1, Number(texto(p.pagina)) || 1);

  const url = (mudar: { ordem?: string; dir?: string; pagina?: number }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    const o = mudar.ordem ?? ordem;
    if (o !== "nome") u.set("ordem", o);
    const d = mudar.dir ?? dir;
    if (d !== (o === "nome" ? "asc" : "desc")) u.set("dir", d);
    const pg = mudar.pagina ?? 1;
    if (pg > 1) u.set("pagina", String(pg));
    const s = u.toString();
    return `/clientes${s ? `?${s}` : ""}`;
  };

  const db = await criarClienteServidor();
  let consulta = db.from("vw_clientes").select("*", { count: "exact" });
  for (const termo of termosBusca(q)) consulta = consulta.ilike("busca", `%${termo}%`);
  consulta = consulta.order(COLUNAS[ordem], { ascending: dir === "asc", nullsFirst: false });
  if (ordem !== "nome") consulta = consulta.order("nome");
  const inicio = (pagina - 1) * POR_PAGINA;
  const { data, count, error } = await consulta.range(inicio, inicio + POR_PAGINA - 1);
  const linhas = (data ?? []) as LinhaCliente[];

  const cab = (coluna: Coluna, rotulo: string, numerico = false) => (
    <CabecalhoOrdenavel
      rotulo={rotulo}
      coluna={coluna}
      ordemAtual={ordem}
      dirAtual={dir}
      numerico={numerico}
      href={(c, d) => url({ ordem: c, dir: d })}
    />
  );

  return (
    <>
      <CabecalhoPagina sobre="Relacionamento comercial" titulo="Clientes" descricao="Propostas, contratos e faturamento de cada cliente desde 2000." />
      <section className="painel">
        <Form action="/clientes" className="filtros" role="search">
          <div className="campo busca">
            <label htmlFor="q">Buscar cliente</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Nome do cliente (acentos e maiúsculas não importam)" />
          </div>
          <div className="atalhos">
            <button className="btn btn-primario" type="submit">
              Buscar
            </button>
            {q ? (
              <Link className="btn btn-texto" href="/clientes">
                Limpar
              </Link>
            ) : null}
          </div>
        </Form>
        {error ? (
          <p className="aviso aviso-erro" style={{ margin: 18 }}>
            Não foi possível carregar os clientes ({error.message}).
          </p>
        ) : linhas.length === 0 ? (
          <div className="vazio">
            <strong>Nenhum cliente encontrado.</strong>
            Confira a grafia ou busque só parte do nome.
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  {cab("nome", "Cliente")}
                  {cab("ultimo", "Período")}
                  {cab("propostas", "Propostas", true)}
                  {cab("contratos", "Contratos", true)}
                  {cab("sucesso", "Sucesso", true)}
                  {cab("contratado", "Contratado (P)", true)}
                  {cab("faturado", "Faturado", true)}
                </tr>
              </thead>
              <tbody>
                {linhas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`} style={{ fontWeight: 500 }}>
                        {c.nome}
                      </Link>
                      {Number(c.valor_contratado_t) > 0 ? (
                        <span className="sub">+ {formatarMoeda(Number(c.valor_contratado_t))}/mês em contratos tipo T</span>
                      ) : null}
                    </td>
                    <td className="tabular">
                      {c.primeiro_ano ? (c.primeiro_ano === c.ultimo_ano ? c.primeiro_ano : `${c.primeiro_ano}–${c.ultimo_ano}`) : "—"}
                    </td>
                    <td className="num">{formatarInteiro(c.propostas)}</td>
                    <td className="num">{formatarInteiro(c.contratos)}</td>
                    <td className="num">{c.pct_sucesso === null ? "—" : formatarPercentual(Number(c.pct_sucesso))}</td>
                    <td className="num">{Number(c.valor_contratado_p) ? formatarMoeda(Number(c.valor_contratado_p)) : "—"}</td>
                    <td className="num">{Number(c.faturado) ? formatarMoeda(Number(c.faturado)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={count ?? 0} href={(pg) => url({ pagina: pg })} />
      </section>
    </>
  );
}
