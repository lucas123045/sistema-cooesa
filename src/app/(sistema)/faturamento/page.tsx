import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { GraficoBarras } from "@/components/graficos";
import { formatarData, formatarInteiro, formatarMoeda, MESES, MESES_CURTOS } from "@/lib/formato";
import { podeEditar } from "@/lib/papeis";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { FaturamentoMensal, NotaFiscal } from "@/lib/tipos";

export const metadata: Metadata = { title: "Faturamento" };

type Anual = { ano: number; quantidade: number; total: number | string; a_receber_quantidade: number; a_receber_valor: number | string };

const IMPOSTOS = [
  ["irpj", "IRPJ"],
  ["csll", "CSLL"],
  ["cofins", "COFINS"],
  ["pis", "PIS"],
  ["inss", "INSS"],
  ["iss", "ISS"],
] as const;

const MENSAGENS_ERRO: Record<string, string> = {
  permissao: "Seu papel não permite alterar notas fiscais.",
};

export default async function PaginaFaturamento(props: PageProps<"/faturamento">) {
  const sessao = await exigirSessao();
  const q = await props.searchParams;
  const db = await criarClienteServidor();

  const { data: anuaisBrutos } = await db.from("vw_faturamento_anual").select("*").order("ano");
  const anuais = (anuaisBrutos ?? []) as Anual[];
  const anoPedido = Number(q.ano);
  // Sem ano na URL, abre no último ano que tem notas (e não no ano corrente, que pode estar vazio).
  const ano = Number.isInteger(anoPedido) && anoPedido >= 1990 ? anoPedido : (anuais.at(-1)?.ano ?? new Date().getFullYear());

  const [mensal, notas] = await Promise.all([
    db.from("vw_faturamento_mensal").select("*").eq("ano", ano),
    db.from("vw_notas").select("*").eq("ano", ano).order("data_emissao", { ascending: false, nullsFirst: true }),
  ]);
  const meses = (mensal.data ?? []) as FaturamentoMensal[];
  const listaNotas = (notas.data ?? []) as NotaFiscal[];

  const total = meses.reduce((s, m) => s + Number(m.total), 0);
  const tributos = meses.reduce((s, m) => s + Number(m.tributos_total), 0);
  const quantidade = meses.reduce((s, m) => s + m.quantidade, 0);
  const hoje = new Date();
  const mesesDecorridos = ano < hoje.getFullYear() ? 12 : ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
  const semData = meses.find((m) => m.mes === null);
  const porMes = Array.from({ length: 12 }, (_, i) => Number(meses.find((m) => m.mes === i + 1)?.total ?? 0));
  const aReceberGeral = anuais.reduce((s, a) => s + Number(a.a_receber_valor), 0);
  const qtdAReceberGeral = anuais.reduce((s, a) => s + a.a_receber_quantidade, 0);
  const editor = podeEditar(sessao.papel);
  const erro = typeof q.erro === "string" ? q.erro : null;

  return (
    <>
      <CabecalhoPagina
        sobre="Notas fiscais"
        titulo="Faturamento"
        descricao="Tudo é calculado a partir das notas fiscais, nunca de totais digitados. Tributos são estimativas pelas alíquotas das Configurações."
        acoes={
          <>
            <a className="btn" href={`/faturamento/exportar?ano=${ano}`}>
              Exportar {ano}
            </a>
            {editor ? (
              <Link className="btn btn-primario" href="/faturamento/notas/nova">
                Nova nota fiscal
              </Link>
            ) : null}
          </>
        }
      />

      <div className="pilha">
        {q.salvo ? <p className="aviso aviso-sucesso">Nota fiscal salva. A alteração está no histórico de auditoria.</p> : null}
        {erro ? <p className="aviso aviso-erro">{MENSAGENS_ERRO[erro] ?? "A operação não foi concluída."}</p> : null}
        {qtdAReceberGeral > 0 ? (
          <p className="aviso aviso-alerta">
            <strong>
              {qtdAReceberGeral} nota(s) sem data de crédito, somando {formatarMoeda(aReceberGeral)}.
            </strong>{" "}
            Estão destacadas em âmbar na tabela de cada ano. Registre o crédito quando o pagamento entrar.
          </p>
        ) : null}

        <nav className="atalhos" aria-label="Ano">
          {anuais.map((a) => (
            <Link key={a.ano} className="atalho" href={`/faturamento?ano=${a.ano}`} aria-pressed={a.ano === ano}>
              {a.ano}
            </Link>
          ))}
        </nav>

        <div className="indicadores">
          <Indicador rotulo={`Faturado em ${ano}`} valor={formatarMoeda(total)} />
          <Indicador rotulo="Notas emitidas" valor={formatarInteiro(quantidade)} />
          <Indicador rotulo="Média mensal" valor={formatarMoeda(total / mesesDecorridos)} detalhe={`sobre ${mesesDecorridos} meses`} />
          <Indicador rotulo="Tributos estimados" valor={formatarMoeda(tributos)} detalhe={total ? `${((tributos / total) * 100).toFixed(1).replace(".", ",")}% do faturado` : undefined} />
        </div>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Faturamento mensal · {ano}</h2>
              {semData ? (
                <span className="nota">
                  + {formatarMoeda(Number(semData.total))} em {semData.quantidade} nota(s) sem data
                </span>
              ) : null}
            </div>
            <div className="painel-corpo">
              <GraficoBarras
                titulo={`Faturamento mensal de ${ano}`}
                categorias={MESES_CURTOS}
                series={[{ nome: "Faturado", classe: "serie-contratos", valores: porMes }]}
                formato="moeda"
                altura={240}
              />
            </div>
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Comparativo anual</h2>
              <span className="nota">Soma das notas por ano</span>
            </div>
            <div className="painel-corpo">
              <GraficoBarras
                titulo="Faturamento por ano"
                categorias={anuais.map((a) => String(a.ano))}
                series={[{ nome: "Faturado", classe: "serie-contratos", valores: anuais.map((a) => Number(a.total)) }]}
                formato="moeda"
                altura={240}
                extras={anuais.map((a) => [`${a.quantidade} notas`])}
              />
            </div>
          </section>
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Mês a mês · {ano}</h2>
            <span className="nota">Tributos estimados por imposto</span>
          </div>
          <div className="tabela-rolagem">
            <table className="tabela compacta">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="num">Notas</th>
                  <th className="num">Faturado</th>
                  <th className="num">A receber</th>
                  {IMPOSTOS.map(([, rotulo]) => (
                    <th className="num" key={rotulo}>
                      {rotulo}
                    </th>
                  ))}
                  <th className="num">Tributos</th>
                </tr>
              </thead>
              <tbody>
                {[...meses]
                  .sort((a, b) => (a.mes ?? 13) - (b.mes ?? 13))
                  .map((m) => (
                    <tr key={String(m.mes)}>
                      <td>{m.mes ? MESES[m.mes - 1] : "Sem data de emissão"}</td>
                      <td className="num">{m.quantidade}</td>
                      <td className="num">{formatarMoeda(Number(m.total))}</td>
                      <td className="num">{Number(m.a_receber_valor) ? formatarMoeda(Number(m.a_receber_valor)) : "—"}</td>
                      {IMPOSTOS.map(([chave]) => (
                        <td className="num" key={chave}>
                          {formatarMoeda(Number(m[chave]))}
                        </td>
                      ))}
                      <td className="num">{formatarMoeda(Number(m.tributos_total))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!meses.length ? <p className="vazio">Nenhuma nota em {ano}. Escolha outro ano acima.</p> : null}
        </section>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Notas fiscais · {ano}</h2>
            <span className="nota">{listaNotas.length} nota(s)</span>
          </div>
          {listaNotas.length ? (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>NF</th>
                    <th>Emissão</th>
                    <th>Crédito</th>
                    <th>Cliente</th>
                    <th>Título</th>
                    <th>Registro</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {listaNotas.map((n) => (
                    <tr key={n.id} className={n.a_receber ? "linha-alerta" : undefined}>
                      <td className="tabular">
                        {editor ? <Link href={`/faturamento/notas/${n.id}/editar`}>{n.numero || "s/nº"}</Link> : n.numero || "s/nº"}
                      </td>
                      <td className="tabular">{n.data_emissao ? formatarData(n.data_emissao) : <span className="selo selo-alerta">sem data</span>}</td>
                      <td className="tabular">{n.data_credito ? formatarData(n.data_credito) : <span className="selo selo-alerta">a receber</span>}</td>
                      <td>
                        {n.cliente_id ? (
                          <Link href={`/clientes/${n.cliente_id}`}>{n.cliente}</Link>
                        ) : (
                          <span className="muted">{n.empresa_texto ?? "—"}</span>
                        )}
                      </td>
                      <td className="celula-escopo">{n.titulo ?? "—"}</td>
                      <td>{n.registro_num ? <Link href={`/registros/${n.registro_num}`}>Nº {n.registro_num}</Link> : "—"}</td>
                      <td className="num">{formatarMoeda(Number(n.valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vazio">Nenhuma nota em {ano}.</p>
          )}
        </section>
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
