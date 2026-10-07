import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Historico } from "@/components/Historico";
import { Icone } from "@/components/Icone";
import { SeloSituacao } from "@/components/SeloSituacao";
import { nomesClientes } from "@/lib/clientes";
import { formatarCnpj, urlSite } from "@/lib/empresas";
import { formatarData, formatarInteiro, formatarMoeda, formatarPercentual, formatarValorRegistro } from "@/lib/formato";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { ContatoEmpresa, LinhaCliente, LinhaHistorico, NotaFiscal } from "@/lib/tipos";
import { ConfirmarUnificacao } from "../ConfirmarUnificacao";
import { Contatos, SeletorStatus } from "./InterativosEmpresa";

export const metadata: Metadata = { title: "Empresa" };

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

function Dado({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "largo" : undefined}>
      <dt>{rotulo}</dt>
      <dd>{children || <span className="muted">—</span>}</dd>
    </div>
  );
}

export default async function PaginaEmpresa(props: PageProps<"/clientes/[id]">) {
  const sessao = await exigirSessao();
  const id = Number((await props.params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const q = await props.searchParams;
  const admin = eAdmin(sessao.papel);
  const editor = podeEditar(sessao.papel);
  // "unificar" vem do link da tela de Pendências; "outro" do seletor desta página.
  const outroId = numeroParam(q.outro) ?? numeroParam(q.unificar);

  const db = await criarClienteServidor();
  const [cliente, registros, notas, contatos, histEmpresa, histContatos, outro, todos] = await Promise.all([
    db.from("vw_clientes").select("*").eq("id", id).maybeSingle(),
    db
      .from("vw_registros")
      .select("num, ano, escopo, situacao, tipo, valor, valor_texto")
      .eq("cliente_id", id)
      .order("num", { ascending: false }),
    db.from("vw_notas").select("*").eq("cliente_id", id).order("data_emissao", { ascending: false }),
    db.from("contatos_empresa").select("*").eq("cliente_id", id).order("principal", { ascending: false }).order("nome"),
    db
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "clientes")
      .eq("chave", String(id))
      .order("quando", { ascending: false }),
    db
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "contatos_empresa")
      .or(`depois->>cliente_id.eq.${id},antes->>cliente_id.eq.${id}`)
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
  const listaContatos = (contatos.data ?? []) as ContatoEmpresa[];
  const historico = [...((histEmpresa.data ?? []) as LinhaHistorico[]), ...((histContatos.data ?? []) as LinhaHistorico[])].sort(
    (a, b) => b.quando.localeCompare(a.quando),
  );
  const o = outro.data as LinhaCliente | null;
  const fica = q.fica === "outro" ? "outro" : "este";
  const site = urlSite(c.site);

  return (
    <>
      <CabecalhoPagina
        icone="clientes"
        sobre={<Link href="/clientes">Empresas</Link>}
        titulo={c.nome}
        descricao={c.razao_social ?? undefined}
        acoes={
          editor ? (
            <>
              <Link className="btn" href={`/clientes/${id}/editar`}>
                <Icone nome="editar" tamanho={16} /> Editar
              </Link>
              <Link className="btn btn-primario" href={`/cadastrar/proposta?cliente=${id}`}>
                <Icone nome="mais" tamanho={16} /> Nova proposta
              </Link>
            </>
          ) : null
        }
      />

      <div className="pilha">
        {q.salvo ? <p className="aviso aviso-sucesso">Empresa salva. A alteração está no histórico.</p> : null}
        {typeof q.unificado === "string" ? (
          <p className="aviso aviso-sucesso">
            “{q.unificado}” foi unificada nesta empresa. A grafia antiga ficou registrada nos registros afetados e no histórico.
          </p>
        ) : null}
        {q.erro === "unificar" ? (
          <p className="aviso aviso-erro">A unificação não foi feita. Confira se as duas empresas ainda existem.</p>
        ) : null}
        {q.erro === "confirmar" ? <p className="aviso aviso-erro">Marque a confirmação antes de unificar.</p> : null}

        <div className="faixa-empresa">
          <SeletorStatus id={id} status={c.status} sugerido={c.status_sugerido} podeEditar={editor} />
          <dl className="faixa-dados">
            <div>
              <dt>CNPJ</dt>
              <dd className="tabular">{c.cnpj ? formatarCnpj(c.cnpj) : "—"}</dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>{c.cidade || c.uf ? [c.cidade, c.uf].filter(Boolean).join("/") : "—"}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{c.responsavel ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="indicadores">
          <Indicador
            rotulo="Propostas"
            valor={formatarInteiro(c.propostas)}
            detalhe={c.ultima_proposta ? `última em ${formatarData(c.ultima_proposta)}` : undefined}
          />
          <Indicador
            rotulo="Contratos"
            valor={formatarInteiro(c.contratos)}
            detalhe={c.pct_sucesso === null ? undefined : `${formatarPercentual(Number(c.pct_sucesso))} de sucesso`}
          />
          <Indicador
            rotulo="Contratado (P)"
            valor={formatarMoeda(Number(c.valor_contratado_p))}
            detalhe={`de ${formatarMoeda(Number(c.valor_proposto_p))} propostos`}
          />
          <Indicador
            rotulo="Contratado (T)"
            valor={Number(c.valor_contratado_t) ? `${formatarMoeda(Number(c.valor_contratado_t))}/mês` : "—"}
            detalhe="valor mensal"
          />
          <Indicador rotulo="Faturado" valor={formatarMoeda(Number(c.faturado))} detalhe={`${c.notas} nota(s)`} />
        </div>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Dados cadastrais</h2>
              {editor ? <Link href={`/clientes/${id}/editar`}>Editar</Link> : null}
            </div>
            <dl className="definicoes">
              <Dado rotulo="Razão social" largo>
                {c.razao_social}
              </Dado>
              <Dado rotulo="Setor">{c.setor}</Dado>
              <Dado rotulo="Como chegou">{c.origem}</Dado>
              <Dado rotulo="Site">
                {site ? (
                  <a href={site} target="_blank" rel="noopener noreferrer">
                    {c.site}
                  </a>
                ) : null}
              </Dado>
              <Dado rotulo="No sistema desde">
                {c.primeiro_ano ? String(c.primeiro_ano) : formatarData(c.criado_em.slice(0, 10))}
              </Dado>
              <Dado rotulo="Observações" largo>
                {c.observacoes}
              </Dado>
            </dl>
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Contatos</h2>
              <span className="nota">dados pessoais — não saem desta tela</span>
            </div>
            <Contatos clienteId={id} contatos={listaContatos} podeEditar={editor} />
          </section>
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Propostas e contratos</h2>
            <Link href={`/registros?q=${encodeURIComponent(c.nome)}`}>Abrir na lista</Link>
          </div>
          {regs.length ? (
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
          ) : (
            <div className="vazio">
              <strong>Nenhuma proposta ainda.</strong>
              {editor ? (
                <Link href={`/cadastrar/proposta?cliente=${id}`}>Cadastrar a primeira proposta para esta empresa</Link>
              ) : null}
            </div>
          )}
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
            <p className="vazio">Nenhuma nota fiscal desta empresa.</p>
          )}
        </section>

        {historico.length ? (
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Histórico</h2>
              <span className="nota">cadastro e contatos</span>
            </div>
            <Historico linhas={historico} />
          </section>
        ) : null}

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
                <strong>Unificar com outra empresa</strong> <span className="muted">(administrador)</span>
              </summary>
              <Form action={`/clientes/${id}`} className="filtros">
                <div className="campo busca">
                  <label htmlFor="outro">Outra empresa (a mesma, com outra grafia)</label>
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
