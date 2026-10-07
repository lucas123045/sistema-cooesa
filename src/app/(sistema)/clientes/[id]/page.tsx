import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Historico } from "@/components/Historico";
import { SeloSituacao } from "@/components/SeloSituacao";
import { nomesClientes } from "@/lib/clientes";
import { formatarData, formatarInteiro, formatarMoeda, formatarPercentual, formatarValorRegistro } from "@/lib/formato";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaCliente, LinhaHistorico, NotaFiscal } from "@/lib/tipos";
import { ConfirmarUnificacao } from "../ConfirmarUnificacao";

export const metadata: Metadata = { title: "Cliente" };

type LinhaRegistro = {
  num: number;
  ano: number;
  escopo: string | null;
  situacao: string | null;
  tipo: "P" | "T";
  valor: number | string | null;
  valor_texto: string | null;
};

function numeroParam(v: string | string[] | undefined): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export default async function PaginaCliente(props: PageProps<"/clientes/[id]">) {
  const sessao = await exigirSessao();
  const id = Number((await props.params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const q = await props.searchParams;
  const admin = eAdmin(sessao.papel);
  // "unificar" vem do link da tela de Pendências; "outro" do seletor desta página.
  const outroId = numeroParam(q.outro) ?? numeroParam(q.unificar);

  const db = await criarClienteServidor();
  const [cliente, registros, notas, historico, outro, todos] = await Promise.all([
    db.from("vw_clientes").select("*").eq("id", id).maybeSingle(),
    db
      .from("vw_registros")
      .select("num, ano, escopo, situacao, tipo, valor, valor_texto")
      .eq("cliente_id", id)
      .order("num", { ascending: false }),
    db.from("vw_notas").select("*").eq("cliente_id", id).order("data_emissao", { ascending: false }),
    db
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "clientes")
      .eq("chave", String(id))
      .order("quando", { ascending: false }),
    admin && outroId && outroId !== id
      ? db.from("vw_clientes").select("*").eq("id", outroId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin ? nomesClientes(db) : Promise.resolve([]),
  ]);
  if (!cliente.data) notFound();

  const c = cliente.data as LinhaCliente;
  const regs = (registros.data ?? []) as LinhaRegistro[];
  const nfs = (notas.data ?? []) as NotaFiscal[];
  const o = outro.data as LinhaCliente | null;
  const fica = q.fica === "outro" ? "outro" : "este";

  return (
    <>
      <CabecalhoPagina
        sobre={<Link href="/clientes">Clientes</Link>}
        titulo={c.nome}
        descricao={c.primeiro_ano ? `Cliente desde ${c.primeiro_ano}.` : undefined}
      />

      <div className="pilha">
        {typeof q.unificado === "string" ? (
          <p className="aviso aviso-sucesso">
            “{q.unificado}” foi unificado neste cliente. A grafia antiga ficou registrada nos registros afetados e no histórico.
          </p>
        ) : null}
        {q.erro === "unificar" ? (
          <p className="aviso aviso-erro">A unificação não foi feita. Confira se os dois clientes ainda existem.</p>
        ) : null}
        {q.erro === "confirmar" ? <p className="aviso aviso-erro">Marque a confirmação antes de unificar.</p> : null}

        <div className="indicadores">
          <Indicador rotulo="Propostas" valor={formatarInteiro(c.propostas)} />
          <Indicador
            rotulo="Contratos"
            valor={formatarInteiro(c.contratos)}
            detalhe={c.pct_sucesso === null ? undefined : `${formatarPercentual(Number(c.pct_sucesso))} de sucesso`}
          />
          <Indicador
            rotulo="Contratado (P)"
            valor={formatarMoeda(Number(c.valor_contratado_p))}
            detalhe={Number(c.valor_contratado_t) ? `+ ${formatarMoeda(Number(c.valor_contratado_t))}/mês (T)` : undefined}
          />
          <Indicador rotulo="Faturado" valor={formatarMoeda(Number(c.faturado))} detalhe={`${c.notas} nota(s)`} />
        </div>

        {admin ? (
          o ? (
            <ConfirmarUnificacao
              origem={fica === "este" ? o : c}
              destino={fica === "este" ? c : o}
              trocarHref={`/clientes/${id}?outro=${o.id}&fica=${fica === "este" ? "outro" : "este"}`}
              cancelarHref={`/clientes/${id}`}
            />
          ) : (
            <details className="painel">
              <summary className="painel-corpo" style={{ cursor: "pointer" }}>
                <strong>Unificar com outro cliente</strong> <span className="muted">(administrador)</span>
              </summary>
              <Form action={`/clientes/${id}`} className="filtros">
                <div className="campo busca">
                  <label htmlFor="outro">Outro cliente (mesma empresa com outra grafia)</label>
                  <select id="outro" name="outro" required defaultValue="">
                    <option value="" disabled>
                      Escolha…
                    </option>
                    {todos
                      .filter((t) => t.id !== id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="atalhos">
                  <button className="btn" type="submit">
                    Ver prévia
                  </button>
                </div>
              </Form>
            </details>
          )
        ) : null}

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Propostas e contratos</h2>
            <Link href={`/registros?q=${encodeURIComponent(c.nome)}`}>Abrir na lista</Link>
          </div>
          <div className="tabela-rolagem">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Ano</th>
                  <th>Escopo</th>
                  <th>Situação</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.num}>
                    <td data-label="Nº" className="c-topo num">
                      <Link href={`/registros/${r.num}`}>{r.num}</Link>
                    </td>
                    <td data-label="Ano" className="tabular">
                      {r.ano}
                    </td>
                    <td className="c-principal celula-escopo">{r.escopo ?? <em className="muted">sem escopo</em>}</td>
                    <td className="c-topo-dir">
                      <SeloSituacao situacao={r.situacao} />
                    </td>
                    <td data-label="Valor" className="num">
                      {r.valor === null
                        ? r.valor_texto
                          ? `“${r.valor_texto}”`
                          : "—"
                        : formatarValorRegistro(Number(r.valor), r.tipo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Notas fiscais</h2>
            <span className="nota tabular">{formatarMoeda(Number(c.faturado))}</span>
          </div>
          {nfs.length ? (
            <div className="tabela-rolagem">
              <table className="tabela tabela-cartoes compacta">
                <thead>
                  <tr>
                    <th>NF</th>
                    <th>Emissão</th>
                    <th>Crédito</th>
                    <th>Título</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {nfs.map((n) => (
                    <tr key={n.id} className={n.a_receber ? "linha-alerta" : undefined}>
                      <td data-label="NF" className="c-topo tabular">
                        {n.numero || "s/nº"}
                      </td>
                      <td data-label="Emissão" className="tabular">
                        {formatarData(n.data_emissao)}
                      </td>
                      <td data-label="Crédito" className="tabular">
                        {n.data_credito ? formatarData(n.data_credito) : <span className="selo selo-alerta">a receber</span>}
                      </td>
                      <td className="c-principal celula-escopo">{n.titulo ?? "—"}</td>
                      <td data-label="Valor" className="num">
                        {formatarMoeda(Number(n.valor))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vazio">Nenhuma nota fiscal deste cliente.</p>
          )}
        </section>

        {(historico.data ?? []).length ? (
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Histórico do cadastro</h2>
            </div>
            <Historico linhas={(historico.data ?? []) as LinhaHistorico[]} />
          </section>
        ) : null}
      </div>
    </>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="indicador">
      <div className="indicador-rotulo">{rotulo}</div>
      <div className="indicador-valor menor">{valor}</div>
      {detalhe ? <div className="indicador-detalhe">{detalhe}</div> : null}
    </div>
  );
}
