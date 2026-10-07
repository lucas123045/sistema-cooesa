import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Icone } from "@/components/Icone";
import { SeloSituacao } from "@/components/SeloSituacao";
import { CabecalhoOrdenavel, Paginacao } from "@/components/tabela";
import { formatarData, formatarInteiro, formatarValorRegistro } from "@/lib/formato";
import { podeEditar } from "@/lib/papeis";
import {
  aplicarFiltros,
  COLUNAS_LISTA,
  COLUNAS_ORDEM,
  lerFiltros,
  paraURL,
  POR_PAGINA,
  temFiltro,
  type ColunaOrdem,
  type FiltrosRegistros,
} from "@/lib/registros/filtros";
import { SITUACOES } from "@/lib/situacoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaRegistroLista } from "@/lib/tipos";

export const metadata: Metadata = { title: "Propostas e contratos" };

async function opcoesFiltros() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("vw_valores_classificacao")
    .select("nivel, valor, usos")
    .in("nivel", ["setor", "area", "gerente"])
    .order("valor");
  const linhas = (data ?? []) as { nivel: string; valor: string; usos: number }[];
  const de = (nivel: string) => linhas.filter((l) => l.nivel === nivel).map((l) => l.valor);
  return { setores: de("setor"), areas: de("area"), gerentes: de("gerente") };
}

export default async function PaginaRegistros(props: PageProps<"/registros">) {
  const sessao = await exigirSessao();
  const filtros = lerFiltros(await props.searchParams);
  const supabase = await criarClienteServidor();

  const inicio = (filtros.pagina - 1) * POR_PAGINA;
  let consulta = aplicarFiltros(supabase.from("vw_registros").select(COLUNAS_LISTA, { count: "exact" }), filtros);
  consulta = consulta.order(COLUNAS_ORDEM[filtros.ordem], { ascending: filtros.dir === "asc", nullsFirst: false });
  if (filtros.ordem !== "num") consulta = consulta.order("num", { ascending: false });
  const [{ data, count, error }, opcoes] = await Promise.all([consulta.range(inicio, inicio + POR_PAGINA - 1), opcoesFiltros()]);
  const linhas = (data ?? []) as unknown as LinhaRegistroLista[];
  const total = count ?? 0;
  const url = (mudar: Partial<FiltrosRegistros>) => `/registros${paraURL(filtros, mudar)}`;
  const semPagina = { ...filtros, pagina: 1 };

  return (
    <>
      <CabecalhoPagina
        sobre="Acervo comercial"
        icone="propostas"
        titulo="Propostas e contratos"
        descricao="Todas as propostas desde 2000. Cada linha é uma proposta; a situação diz se virou contrato."
        acoes={
          <>
            <a className="btn" href={`/registros/exportar${paraURL(semPagina)}${paraURL(semPagina) ? "&" : "?"}formato=xlsx`}>
              <Icone nome="exportar" tamanho={16} /> Excel
            </a>
            <a className="btn" href={`/registros/exportar${paraURL(semPagina)}${paraURL(semPagina) ? "&" : "?"}formato=csv`}>
              <Icone nome="exportar" tamanho={16} /> CSV
            </a>
            {podeEditar(sessao.papel) ? (
              <Link className="btn btn-primario" href="/registros/novo">
                <Icone nome="mais" tamanho={16} /> Nova proposta
              </Link>
            ) : null}
          </>
        }
      />

      <div className="painel">
        <Form action="/registros" className="filtros" role="search">
          <div className="campo busca">
            <label htmlFor="q">Busca</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filtros.q}
              placeholder="Nº, cliente, escopo, gerente, classificação…"
            />
          </div>
          <div className="campo">
            <label htmlFor="situacao">Situação</label>
            <select id="situacao" name="situacao" defaultValue={filtros.situacao}>
              <option value="">Todas</option>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="sem">Sem situação</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="de">Ano de</label>
            <input id="de" name="de" type="number" min={2000} max={2100} defaultValue={filtros.anoDe ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="ate">Ano até</label>
            <input id="ate" name="ate" type="number" min={2000} max={2100} defaultValue={filtros.anoAte ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="setor">Setor</label>
            <select id="setor" name="setor" defaultValue={filtros.setor}>
              <option value="">Todos</option>
              {opcoes.setores.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="area">Área</label>
            <select id="area" name="area" defaultValue={filtros.area}>
              <option value="">Todas</option>
              {opcoes.areas.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="gerente">Gerente</label>
            <select id="gerente" name="gerente" defaultValue={filtros.gerente}>
              <option value="">Todos</option>
              {opcoes.gerentes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="entidade">Entidade</label>
            <select id="entidade" name="entidade" defaultValue={filtros.entidade}>
              <option value="">Todas</option>
              <option value="Cooesa Ltda">Cooesa Ltda</option>
              <option value="Cooperativa">Cooperativa</option>
              <option value="sem">Não informada</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={filtros.tipo}>
              <option value="">P e T</option>
              <option value="P">P — valor total</option>
              <option value="T">T — valor mensal</option>
            </select>
          </div>
          {filtros.atalho ? <input type="hidden" name="atalho" value={filtros.atalho} /> : null}
          {filtros.ordem !== "num" || filtros.dir !== "desc" ? (
            <>
              <input type="hidden" name="ordem" value={filtros.ordem} />
              <input type="hidden" name="dir" value={filtros.dir} />
            </>
          ) : null}
          <div className="atalhos">
            <button className="btn btn-primario" type="submit">
              Filtrar
            </button>
            {temFiltro(filtros) ? (
              <Link className="btn btn-texto" href="/registros">
                Limpar
              </Link>
            ) : null}
          </div>
        </Form>

        <div className="barra-resultado">
          <div className="atalhos" aria-label="Atalhos">
            <Link
              className="atalho"
              href={url({ atalho: "", situacao: "", pagina: 1 })}
              aria-pressed={!filtros.atalho && !filtros.situacao}
            >
              Todas
            </Link>
            <Link
              className="atalho"
              href={url({ atalho: "contratos", situacao: "", pagina: 1 })}
              aria-pressed={filtros.atalho === "contratos"}
            >
              Só contratos
            </Link>
            <Link
              className="atalho"
              href={url({ atalho: "aguardando", situacao: "", pagina: 1 })}
              aria-pressed={filtros.atalho === "aguardando"}
            >
              Aguardando
            </Link>
            <Link
              className="atalho"
              href={url({ atalho: "litigio", situacao: "", pagina: 1 })}
              aria-pressed={filtros.atalho === "litigio"}
            >
              Em litígio
            </Link>
          </div>
          <span className="tabular">{formatarInteiro(total)} registro(s)</span>
        </div>

        {error ? (
          <p className="aviso aviso-erro" style={{ margin: 18 }}>
            Não foi possível carregar os registros. Recarregue a página; se continuar, avise o administrador (pode ser a conexão
            com o Supabase).
          </p>
        ) : linhas.length === 0 ? (
          <div className="vazio">
            <strong>Nenhum registro com esses filtros.</strong>
            Limpe a busca ou mude o ano. <Link href="/registros">Ver todos</Link>
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  {cabecalho(filtros, "num", "Nº", true, "col-num")}
                  {cabecalho(filtros, "cliente", "Cliente / escopo")}
                  {cabecalho(filtros, "area", "Área")}
                  {cabecalho(filtros, "data", "Início")}
                  {cabecalho(filtros, "situacao", "Situação")}
                  {cabecalho(filtros, "valor", "Valor", true)}
                </tr>
              </thead>
              <tbody>
                {linhas.map((r) => (
                  <tr key={r.num} className={r.situacao === "Proposta colocada" ? "linha-alerta" : undefined}>
                    <td data-label="Nº" className="c-topo num">
                      <Link href={`/registros/${r.num}`}>{r.num}</Link>
                    </td>
                    <td className="c-principal celula-escopo">
                      <Link href={`/registros/${r.num}`} style={{ color: "var(--texto)", fontWeight: 500 }}>
                        {r.cliente}
                      </Link>
                      <span className="sub">{r.escopo ?? <em className="muted">sem escopo</em>}</span>
                    </td>
                    <td data-label="Área">
                      {r.area ?? <span className="muted">—</span>}
                      {r.setor ? <span className="sub">{r.setor}</span> : null}
                    </td>
                    <td data-label="Início" className="tabular" style={{ whiteSpace: "nowrap" }}>
                      {r.data_ini ? (
                        formatarData(r.data_ini)
                      ) : r.data_ini_texto ? (
                        <span className="selo selo-alerta" title="Data original da planilha, ilegível">
                          “{r.data_ini_texto}”
                        </span>
                      ) : (
                        <span className="muted">{r.ano}</span>
                      )}
                    </td>
                    <td className="c-topo-dir">
                      <SeloSituacao situacao={r.situacao} />
                    </td>
                    <td data-label="Valor" className="num">
                      {r.valor !== null ? (
                        formatarValorRegistro(Number(r.valor), r.tipo)
                      ) : r.valor_texto ? (
                        <span className="muted" title="Valor original em texto">
                          “{r.valor_texto}”
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao pagina={filtros.pagina} porPagina={POR_PAGINA} total={total} href={(p) => url({ pagina: p })} />
      </div>
    </>
  );
}

function cabecalho(f: FiltrosRegistros, coluna: ColunaOrdem, rotulo: string, numerico = false, className?: string) {
  return (
    <CabecalhoOrdenavel
      rotulo={rotulo}
      coluna={coluna}
      ordemAtual={f.ordem}
      dirAtual={f.dir}
      numerico={numerico}
      className={className}
      href={(c, d) => `/registros${paraURL(f, { ordem: c as ColunaOrdem, dir: d, pagina: 1 })}`}
    />
  );
}
