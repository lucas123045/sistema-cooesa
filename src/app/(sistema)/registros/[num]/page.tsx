import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Historico } from "@/components/Historico";
import { MarcarVisita } from "@/components/recentes";
import { SeloSituacao } from "@/components/SeloSituacao";
import { formatarData, formatarMoeda, formatarValorRegistro } from "@/lib/formato";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { ROTULO_TIPO_PENDENCIA } from "@/lib/rotulos";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Acompanhamento, LinhaHistorico, NotaFiscal, Pendencia, Registro } from "@/lib/tipos";
import { BotaoExcluirRegistro, FormAcompanhamento } from "./ComponentesDetalhe";

export async function generateMetadata(props: PageProps<"/registros/[num]">): Promise<Metadata> {
  const { num } = await props.params;
  return { title: `Registro Nº ${num}` };
}

function Campo({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "largo" : undefined}>
      <dt>{rotulo}</dt>
      <dd>{children ?? <span className="muted">—</span>}</dd>
    </div>
  );
}

function Original({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <span className="selo selo-alerta" title="Como estava digitado na planilha" style={{ marginLeft: 6 }}>
      planilha: “{texto}”
    </span>
  );
}

export default async function PaginaRegistro(props: PageProps<"/registros/[num]">) {
  const sessao = await exigirSessao();
  const { num: numTexto } = await props.params;
  const q = await props.searchParams;
  const num = Number(numTexto);
  if (!Number.isInteger(num) || num <= 0) notFound();

  const supabase = await criarClienteServidor();
  const [reg, acomp, notas, hist, pend] = await Promise.all([
    supabase.from("registros").select("*, clientes(nome)").eq("num", num).maybeSingle(),
    supabase.from("acompanhamentos").select("*").eq("registro_num", num).order("id"),
    supabase.from("vw_notas").select("*").eq("registro_num", num).order("data_emissao"),
    supabase
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "registros")
      .eq("chave", String(num))
      .order("quando", { ascending: false })
      .limit(100),
    supabase.from("vw_pendencias").select("*").eq("registro_num", num),
  ]);
  if (!reg.data) notFound();

  const r = reg.data as Registro & { clientes: { nome: string } | null };
  const acompanhamentos = (acomp.data ?? []) as Acompanhamento[];
  const notasFiscais = (notas.data ?? []) as NotaFiscal[];
  const historico = (hist.data ?? []) as LinhaHistorico[];
  const pendencias = (pend.data ?? []) as Pendencia[];
  const totalNotas = notasFiscais.reduce((s, n) => s + Number(n.valor), 0);
  const editor = podeEditar(sessao.papel);

  return (
    <>
      <MarcarVisita num={r.num} cliente={r.clientes?.nome ?? "—"} escopo={r.escopo} />
      <CabecalhoPagina
        sobre={
          <>
            <Link href="/registros">Propostas e contratos</Link> · Registro Nº {r.num}
          </>
        }
        titulo={r.clientes?.nome ?? "—"}
        descricao={r.escopo ?? "Sem escopo registrado."}
        acoes={
          <>
            {editor ? (
              <Link className="btn btn-primario" href={`/registros/${r.num}/editar`}>
                Editar
              </Link>
            ) : null}
            {eAdmin(sessao.papel) ? <BotaoExcluirRegistro num={r.num} /> : null}
          </>
        }
      />

      <div className="pilha">
        {q.salvo ? <p className="aviso aviso-sucesso">Registro salvo. A alteração está no histórico abaixo.</p> : null}
        {q.vinculado ? <p className="aviso aviso-sucesso">Acompanhamento antigo vinculado a este registro.</p> : null}
        {q.erro === "excluir" ? <p className="aviso aviso-erro">O registro não foi excluído. Só administradores podem excluir.</p> : null}

        {pendencias.length ? (
          <div className="aviso aviso-alerta">
            <strong>Pendências de dados neste registro:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {pendencias.map((p) => (
                <li key={p.tipo + p.chave}>
                  {ROTULO_TIPO_PENDENCIA[p.tipo] ?? p.tipo}: {p.descricao}
                </li>
              ))}
            </ul>
            {editor ? (
              <p style={{ margin: "8px 0 0" }}>
                <Link href={`/registros/${r.num}/editar`}>Corrigir no formulário de edição →</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Dados do registro</h2>
            <SeloSituacao situacao={r.situacao} />
          </div>
          <dl className="definicoes">
            <Campo rotulo="Nº">{r.num}</Campo>
            <Campo rotulo="Ano">{r.ano}</Campo>
            <Campo rotulo="Cliente">
              {r.clientes ? <Link href={`/clientes/${r.cliente_id}`}>{r.clientes.nome}</Link> : null}
              {r.empresa_original ? <Original texto={r.empresa_original} /> : null}
            </Campo>
            <Campo rotulo="Contato">{r.contato}</Campo>
            <Campo rotulo="Gerente de contrato">{r.gerente}</Campo>
            <Campo rotulo="Entidade">{r.entidade}</Campo>
            <Campo rotulo="Início">
              {r.data_ini ? formatarData(r.data_ini) : null}
              <Original texto={r.data_ini_texto} />
            </Campo>
            <Campo rotulo="Encerramento">
              {r.data_enc ? formatarData(r.data_enc) : null}
              <Original texto={r.data_enc_texto} />
            </Campo>
            <Campo rotulo="Tipo">{r.tipo === "T" ? "T — trabalho / mão de obra (valor mensal)" : "P — produção / serviço (valor total)"}</Campo>
            <Campo rotulo="Valor da proposta">
              <span className="tabular">{r.valor !== null ? formatarValorRegistro(Number(r.valor), r.tipo) : null}</span>
              <Original texto={r.valor_texto} />
            </Campo>
            <Campo rotulo="Valor do vencedor">{r.valor_vencedor !== null ? formatarMoeda(Number(r.valor_vencedor)) : null}</Campo>
            <Campo rotulo="Escopo" largo>
              {r.escopo}
            </Campo>
            <Campo rotulo="Setor (A)">{r.setor}</Campo>
            <Campo rotulo="Área (B)">{r.area}</Campo>
            <Campo rotulo="Empreendimento (C)">{r.empreendimento}</Campo>
            <Campo rotulo="Serviço (D)">{r.servico}</Campo>
            <Campo rotulo="Especialidade (E)">{r.especialidade}</Campo>
            <Campo rotulo="Observações" largo>
              {r.obs}
            </Campo>
          </dl>
        </section>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Acompanhamentos</h2>
              <span className="nota">{acompanhamentos.length} anotação(ões), em ordem cronológica</span>
            </div>
            {acompanhamentos.length ? (
              <ul className="linha-tempo">
                {acompanhamentos.map((a) => (
                  <li key={a.id}>
                    <div className="pequeno muted">{a.fonte === "Sistema" ? formatarData(a.criado_em.slice(0, 10)) : a.fonte}</div>
                    <div>
                      {a.situacao_na_epoca ? <SeloSituacao situacao={a.situacao_na_epoca} /> : null}
                      {a.obs ? <p style={{ margin: "4px 0 0" }}>{a.obs}</p> : null}
                      {a.a_receber !== null ? (
                        <p className="pequeno texto-2 tabular" style={{ margin: "4px 0 0" }}>
                          A receber: {formatarMoeda(Number(a.a_receber))}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vazio">Nenhuma anotação ainda.</p>
            )}
            {editor ? <FormAcompanhamento num={r.num} /> : null}
          </section>

          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Notas fiscais vinculadas</h2>
              <span className="nota tabular">{formatarMoeda(totalNotas)}</span>
            </div>
            {notasFiscais.length ? (
              <div className="tabela-rolagem">
                <table className="tabela compacta">
                  <thead>
                    <tr>
                      <th>NF</th>
                      <th>Emissão</th>
                      <th>Crédito</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notasFiscais.map((n) => (
                      <tr key={n.id} className={n.a_receber ? "linha-alerta" : undefined}>
                        <td>
                          <Link href={`/faturamento/notas/${n.id}/editar`}>{n.numero || "s/nº"}</Link>
                          <span className="sub">{n.titulo}</span>
                        </td>
                        <td className="tabular">{formatarData(n.data_emissao)}</td>
                        <td className="tabular">{n.data_credito ? formatarData(n.data_credito) : <span className="selo selo-alerta">a receber</span>}</td>
                        <td className="num">{formatarMoeda(Number(n.valor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vazio">Nenhuma nota fiscal vinculada a este registro.</p>
            )}
          </section>
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Histórico de alterações</h2>
            <span className="nota">Quem mudou, quando e o quê</span>
          </div>
          <Historico linhas={historico} />
        </section>
      </div>
    </>
  );
}
