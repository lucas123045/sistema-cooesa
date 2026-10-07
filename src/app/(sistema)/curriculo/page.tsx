import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Icone } from "@/components/Icone";
import { Logo } from "@/components/marca/Logo";
import { SeloSituacao } from "@/components/SeloSituacao";
import { lerTudo } from "@/lib/consultas";
import { formatarData, formatarValorRegistro } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaCurriculo } from "@/lib/tipos";
import { BotaoImprimir, SelectEncadeado } from "./BotaoImprimir";

export const metadata: Metadata = { title: "Currículo" };

const NIVEIS = [
  ["setor", "A — Setor"],
  ["area", "B — Área"],
  ["empreendimento", "C — Empreendimento"],
  ["servico", "D — Serviço"],
  ["especialidade", "E — Especialidade"],
] as const;
type Nivel = (typeof NIVEIS)[number][0];

function texto(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 120) ?? "";
}

export default async function PaginaCurriculo(props: PageProps<"/curriculo">) {
  await exigirSessao();
  const p = await props.searchParams;
  const selecao = Object.fromEntries(NIVEIS.map(([n]) => [n, texto(p[n])])) as Record<Nivel, string>;
  const de = Number(texto(p.de)) || null;
  const ate = Number(texto(p.ate)) || null;
  const andamento = texto(p.andamento) === "1";
  const valores = texto(p.valores) === "1";

  const db = await criarClienteServidor();
  let todos: LinhaCurriculo[] = [];
  let falhou = false;
  try {
    todos = await lerTudo<LinhaCurriculo>((a, b) =>
      db.from("vw_curriculo").select("*").order("ano", { ascending: false }).order("num", { ascending: false }).range(a, b),
    );
  } catch {
    falhou = true;
  }

  const base = todos.filter(
    (x) => (andamento || x.situacao === "Contrato encerrado") && (!de || x.ano >= de) && (!ate || x.ano <= ate),
  );
  // Cada nível só oferece opções compatíveis com os níveis acima já escolhidos.
  const opcoes = (indice: number) => {
    const acima = NIVEIS.slice(0, indice).map(([n]) => n);
    const campo = NIVEIS[indice][0];
    const compativeis = base.filter((x) => acima.every((n) => !selecao[n] || x[n] === selecao[n]));
    return [...new Set(compativeis.map((x) => x[campo]).filter((v): v is string => Boolean(v)))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  };
  const linhas = base.filter((x) => NIVEIS.every(([n]) => !selecao[n] || x[n] === selecao[n]));

  const qs = new URLSearchParams();
  for (const [n] of NIVEIS) if (selecao[n]) qs.set(n, selecao[n]);
  if (de) qs.set("de", String(de));
  if (ate) qs.set("ate", String(ate));
  if (andamento) qs.set("andamento", "1");
  if (valores) qs.set("valores", "1");
  const filtrosTexto = [
    ...NIVEIS.filter(([n]) => selecao[n]).map(([n]) => selecao[n]),
    de || ate ? `${de ?? "início"}–${ate ?? "hoje"}` : null,
    andamento ? "inclui contratos em andamento" : "contratos encerrados",
  ].filter(Boolean);

  return (
    <>
      <CabecalhoPagina
        sobre="Acervo técnico"
        icone="curriculo"
        titulo="Currículo"
        descricao="Contratos que comprovam experiência, para montar o currículo de licitações. Por padrão, só os encerrados."
        acoes={
          <>
            <a className="btn" href={`/curriculo/exportar?${qs.toString()}`}>
              <Icone nome="exportar" tamanho={16} /> Exportar Excel
            </a>
            <BotaoImprimir />
          </>
        }
      />

      <div className="so-impressao cabecalho-impressao">
        <Logo variante="azul" />
        <p>
          <strong>Cooesa Engenharia S/S Ltda.</strong> · Currículo técnico
          <br />
          Rua Bela Cintra, 299 · São Paulo · {filtrosTexto.join(" · ")}
        </p>
      </div>

      <section className="painel">
        <Form action="/curriculo" className="filtros">
          {NIVEIS.map(([n, rotulo], i) => (
            <div className="campo" key={n}>
              <label htmlFor={n}>{rotulo}</label>
              <SelectEncadeado id={n} name={n} defaultValue={selecao[n]}>
                <option value="">Todos</option>
                {opcoes(i).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </SelectEncadeado>
            </div>
          ))}
          <div className="campo">
            <label htmlFor="de">Ano de</label>
            <input id="de" name="de" type="number" min={1990} max={2100} defaultValue={de ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="ate">Ano até</label>
            <input id="ate" name="ate" type="number" min={1990} max={2100} defaultValue={ate ?? ""} />
          </div>
          <label className="checagem">
            <input type="checkbox" name="andamento" value="1" defaultChecked={andamento} /> Incluir contratos em andamento
          </label>
          <label className="checagem">
            <input type="checkbox" name="valores" value="1" defaultChecked={valores} /> Mostrar valores
          </label>
          <div className="atalhos">
            <button className="btn btn-primario" type="submit">
              Filtrar
            </button>
            {qs.toString() ? (
              <Link className="btn btn-texto" href="/curriculo">
                Limpar
              </Link>
            ) : null}
          </div>
        </Form>

        <div className="barra-resultado">
          <span>
            <strong>{linhas.length}</strong> contrato(s) · {filtrosTexto.join(" · ")}
          </span>
        </div>

        {falhou ? (
          <p className="aviso aviso-erro" style={{ margin: 18 }}>
            Não foi possível carregar os contratos. Recarregue a página.
          </p>
        ) : linhas.length === 0 ? (
          <div className="vazio">
            <strong>Nenhum contrato com esses filtros.</strong>
            Tire um dos níveis da classificação ou amplie o intervalo de anos.
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Ano</th>
                  <th>Cliente e escopo</th>
                  <th>Classificação</th>
                  <th>Período</th>
                  <th className="nao-imprimir">Situação</th>
                  {valores ? <th className="num">Valor</th> : null}
                </tr>
              </thead>
              <tbody>
                {linhas.map((x) => (
                  <tr key={x.num}>
                    <td data-label="Ano" className="c-topo tabular">
                      {x.ano}
                    </td>
                    <td className="c-principal celula-escopo">
                      <Link href={`/registros/${x.num}`} style={{ color: "var(--texto)", fontWeight: 500 }}>
                        {x.cliente}
                      </Link>
                      <span className="sub">{x.escopo ?? "—"}</span>
                    </td>
                    <td data-label="Classificação" className="c-largo pequeno texto-2">
                      {[x.setor, x.area, x.empreendimento, x.servico, x.especialidade].filter(Boolean).join(" › ") || "—"}
                    </td>
                    <td data-label="Período" className="tabular pequeno">
                      {x.data_ini ? formatarData(x.data_ini) : "—"}
                      {x.data_enc ? ` a ${formatarData(x.data_enc)}` : ""}
                    </td>
                    <td className="c-topo-dir nao-imprimir">
                      <SeloSituacao situacao={x.situacao} />
                    </td>
                    {valores ? (
                      <td data-label="Valor" className="num">
                        {x.valor === null ? "—" : formatarValorRegistro(Number(x.valor), x.tipo)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
