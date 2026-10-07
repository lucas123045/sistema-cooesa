import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Icone } from "@/components/Icone";
import { SeloStatusEmpresa } from "@/components/SeloStatusEmpresa";
import { CabecalhoOrdenavel, Paginacao } from "@/components/tabela";
import { lerTudo } from "@/lib/consultas";
import { STATUS_EMPRESA, UFS } from "@/lib/empresas";
import {
  aplicarFiltrosEmpresas,
  COLUNAS_EMPRESA,
  lerFiltrosEmpresas,
  paraURLEmpresas,
  POR_PAGINA_EMPRESAS,
  temFiltroEmpresas,
  type ColunaEmpresa,
  type FiltrosEmpresas,
} from "@/lib/empresas-filtros";
import { formatarData, formatarInteiro, formatarMoeda } from "@/lib/formato";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaCliente } from "@/lib/tipos";

export const metadata: Metadata = { title: "Empresas" };

const ATALHOS: { rotulo: string; status: string }[] = [
  { rotulo: "Todas", status: "" },
  ...STATUS_EMPRESA.map((s) => ({ rotulo: s, status: s })),
  { rotulo: "Sem status", status: "sem" },
];

export default async function PaginaEmpresas(props: PageProps<"/clientes">) {
  const sessao = await exigirSessao();
  const params = await props.searchParams;
  const f = lerFiltrosEmpresas(params);
  const url = (mudar: Partial<FiltrosEmpresas>) => `/clientes${paraURLEmpresas(f, { pagina: 1, ...mudar })}`;

  const db = await criarClienteServidor();
  const inicio = (f.pagina - 1) * POR_PAGINA_EMPRESAS;
  let consulta = aplicarFiltrosEmpresas(db.from("vw_clientes").select("*", { count: "exact" }), f);
  consulta = consulta.order(COLUNAS_EMPRESA[f.ordem], { ascending: f.dir === "asc", nullsFirst: false });
  if (f.ordem !== "nome") consulta = consulta.order("nome");

  const [{ data, count, error }, opcoes, semStatus] = await Promise.all([
    consulta.range(inicio, inicio + POR_PAGINA_EMPRESAS - 1),
    lerTudo<{ setor: string | null; responsavel: string | null }>((a, b) =>
      db.from("clientes").select("setor, responsavel").range(a, b),
    ).catch(() => []),
    db.from("clientes").select("*", { count: "exact", head: true }).is("status", null),
  ]);
  const linhas = (data ?? []) as LinhaCliente[];
  const unicos = (k: "setor" | "responsavel") =>
    [...new Set(opcoes.map((o) => o[k]).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const qtdSemStatus = semStatus.count ?? 0;
  const exportar = (formato: string) => {
    const qs = paraURLEmpresas({ ...f, pagina: 1 });
    return `/clientes/exportar${qs}${qs ? "&" : "?"}formato=${formato}`;
  };

  const cab = (coluna: ColunaEmpresa, rotulo: string, numerico = false) => (
    <CabecalhoOrdenavel
      rotulo={rotulo}
      coluna={coluna}
      ordemAtual={f.ordem}
      dirAtual={f.dir}
      numerico={numerico}
      href={(c, d) => url({ ordem: c as ColunaEmpresa, dir: d })}
    />
  );

  return (
    <>
      <CabecalhoPagina
        icone="clientes"
        sobre="Relacionamento comercial"
        titulo="Empresas"
        descricao="Clientes e empresas em prospecção: cadastro, status, contatos, propostas e valores de cada uma."
        acoes={
          <>
            <a className="btn" href={exportar("xlsx")}>
              <Icone nome="exportar" tamanho={16} /> Excel
            </a>
            <a className="btn" href={exportar("csv")}>
              <Icone nome="exportar" tamanho={16} /> CSV
            </a>
            {podeEditar(sessao.papel) ? (
              <Link className="btn btn-primario" href="/clientes/nova">
                <Icone nome="mais" tamanho={16} /> Nova empresa
              </Link>
            ) : null}
          </>
        }
      />

      <div className="pilha">
        {params.aplicado ? (
          <p className="aviso aviso-sucesso">Status sugerido aplicado. Cada mudança está no histórico da empresa.</p>
        ) : null}
        {eAdmin(sessao.papel) && qtdSemStatus > 0 ? (
          <p className="aviso aviso-alerta">
            <strong>{formatarInteiro(qtdSemStatus)} empresas ainda sem status.</strong> O sistema sugere um status para cada uma a
            partir das propostas e contratos. <Link href="/clientes/status-sugerido">Revisar e aplicar as sugestões</Link>
          </p>
        ) : null}

        <section className="painel">
          <Form action="/clientes" className="filtros" role="search">
            <div className="campo busca">
              <label htmlFor="q">Buscar</label>
              <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Nome, razão social, CNPJ ou cidade" />
            </div>
            <div className="campo">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={f.status}>
                <option value="">Todos</option>
                {STATUS_EMPRESA.map((s) => (
                  <option key={s}>{s}</option>
                ))}
                <option value="sem">Sem status</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="setor">Setor</label>
              <select id="setor" name="setor" defaultValue={f.setor}>
                <option value="">Todos</option>
                {unicos("setor").map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="uf">UF</label>
              <select id="uf" name="uf" defaultValue={f.uf}>
                <option value="">Todas</option>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="responsavel">Responsável</label>
              <select id="responsavel" name="responsavel" defaultValue={f.responsavel}>
                <option value="">Todos</option>
                {unicos("responsavel").map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {f.ordem !== "nome" ? (
              <>
                <input type="hidden" name="ordem" value={f.ordem} />
                <input type="hidden" name="dir" value={f.dir} />
              </>
            ) : null}
            <div className="atalhos">
              <button className="btn btn-primario" type="submit">
                Filtrar
              </button>
              {temFiltroEmpresas(f) ? (
                <Link className="btn btn-texto" href="/clientes">
                  Limpar
                </Link>
              ) : null}
            </div>
          </Form>

          <div className="barra-resultado">
            <div className="atalhos" aria-label="Atalhos de status">
              {ATALHOS.map((a) => (
                <Link key={a.rotulo} className="atalho" href={url({ status: a.status })} aria-pressed={f.status === a.status}>
                  {a.rotulo}
                </Link>
              ))}
            </div>
            <span className="tabular">{formatarInteiro(count ?? 0)} empresa(s)</span>
          </div>

          {error ? (
            <p className="aviso aviso-erro" style={{ margin: 18 }}>
              Não foi possível carregar as empresas. Recarregue a página; se continuar, avise o administrador.
            </p>
          ) : linhas.length === 0 ? (
            <div className="vazio">
              <strong>Nenhuma empresa com esses filtros.</strong>
              Limpe a busca ou escolha outro status.{" "}
              {podeEditar(sessao.papel) ? <Link href="/clientes/nova">Cadastrar uma empresa nova</Link> : null}
            </div>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    {cab("nome", "Empresa")}
                    {cab("status", "Status")}
                    {cab("local", "Cidade/UF")}
                    {cab("propostas", "Propostas", true)}
                    {cab("contratos", "Contratos", true)}
                    {cab("contratado", "Contratado (P)", true)}
                    {cab("ultima", "Última proposta")}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((c) => (
                    <tr key={c.id}>
                      <td className="c-principal">
                        <Link href={`/clientes/${c.id}`} style={{ fontWeight: 500 }}>
                          {c.nome}
                        </Link>
                        {c.razao_social ? <span className="sub">{c.razao_social}</span> : null}
                      </td>
                      <td className="c-topo">
                        <SeloStatusEmpresa status={c.status} />
                      </td>
                      <td data-label="Cidade/UF">{c.cidade || c.uf ? [c.cidade, c.uf].filter(Boolean).join("/") : "—"}</td>
                      <td data-label="Propostas" className="num">
                        {formatarInteiro(c.propostas)}
                      </td>
                      <td data-label="Contratos" className="num">
                        {formatarInteiro(c.contratos)}
                      </td>
                      <td data-label="Contratado (P)" className="num">
                        {Number(c.valor_contratado_p) ? formatarMoeda(Number(c.valor_contratado_p)) : "—"}
                      </td>
                      <td data-label="Última proposta" className="tabular">
                        {c.ultima_proposta ? formatarData(c.ultima_proposta) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacao
            pagina={f.pagina}
            porPagina={POR_PAGINA_EMPRESAS}
            total={count ?? 0}
            href={(pg) => `/clientes${paraURLEmpresas(f, { pagina: pg })}`}
          />
        </section>
      </div>
    </>
  );
}
