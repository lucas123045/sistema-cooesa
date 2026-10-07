import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { GraficoBarras } from "@/components/graficos";
import { lerTudo } from "@/lib/consultas";
import { formatarData, formatarDataHora, formatarInteiro, formatarMoeda, formatarPercentual, hojeBrasil } from "@/lib/formato";
import { eAdmin } from "@/lib/papeis";
import {
  agregar,
  agregarPor,
  contratadoPorCliente,
  diferencaPontos,
  faturadoPorCliente,
  situacaoCreditos,
  variacao,
  type NotaResultado,
  type RegistroResultado,
} from "@/lib/resultados";
import { GRUPO_SITUACAO, ROTULO_GRUPO, type GrupoSituacao, type Situacao } from "@/lib/situacoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { AnaliseResultadosIA, type AnaliseSalva } from "./AnaliseResultadosIA";
import { Indicador, moeda, TabelaDesempenho, Variacao } from "./componentes";

export const metadata: Metadata = { title: "Resultados" };

type FaturamentoAno = { ano: number; tributos_total: number | string };

function anoParam(v: string | string[] | undefined): number | null {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : null;
}

const ORDEM_GRUPOS: (GrupoSituacao | "sem")[] = ["contrato", "aguardando", "perdida", "cancelada", "litigio", "sem"];

export default async function PaginaResultados(props: PageProps<"/resultados">) {
  const sessao = await exigirSessao();
  const q = await props.searchParams;
  const db = await criarClienteServidor();

  let registros: RegistroResultado[] = [];
  let notas: NotaResultado[] = [];
  let falhou = false;
  try {
    [registros, notas] = await Promise.all([
      lerTudo<RegistroResultado>((a, b) =>
        db
          .from("vw_registros")
          .select("num, cliente_id, cliente, situacao, contrato_total, tipo, valor, ano, area, setor, gerente")
          .order("num")
          .range(a, b),
      ),
      lerTudo<NotaResultado>((a, b) =>
        db.from("vw_notas").select("ano, valor, data_emissao, data_credito, cliente_id, cliente").order("id").range(a, b),
      ),
    ]);
  } catch {
    falhou = true;
  }
  const [{ data: fatAnual }, { data: iaSalva }] = await Promise.all([
    db.from("vw_faturamento_anual").select("ano, tributos_total"),
    db.from("configuracoes").select("valor").eq("chave", "ia_resultados").maybeSingle(),
  ]);

  // ---------- Período ----------
  const anoAtual = hojeBrasil().ano;
  const primeiroAno = Math.min(...registros.map((r) => r.ano), anoAtual);
  const de = anoParam(q.de) ?? primeiroAno;
  const ate = anoParam(q.ate) ?? anoAtual;
  const noPeriodo = registros.filter((r) => r.ano >= de && r.ano <= ate);
  const notasPeriodo = notas.filter((n) => n.ano >= de && n.ano <= ate);
  const ultimoAnoNotas = Math.max(0, ...notas.map((n) => n.ano));
  const presets = [
    { rotulo: "Todo o histórico", de: primeiroAno, ate: anoAtual },
    { rotulo: "Últimos 5 anos", de: anoAtual - 4, ate: anoAtual },
    { rotulo: "Últimos 10 anos", de: anoAtual - 9, ate: anoAtual },
    { rotulo: "Desde 2020", de: 2020, ate: anoAtual },
  ];

  // Ano de referência do comparativo: o último ano COMPLETO do período.
  const anoRef = Math.min(ate, anoAtual - 1);
  const ref = agregar(registros.filter((r) => r.ano === anoRef));
  const antes = agregar(registros.filter((r) => r.ano === anoRef - 1));
  const faturadoAno = (ano: number) => notas.filter((n) => n.ano === ano).reduce((s, n) => s + Number(n.valor), 0);

  // ---------- Agregados ----------
  const total = agregar(noPeriodo);
  const anos = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const porAno = anos.map((ano) => ({ ano, dados: agregar(noPeriodo.filter((r) => r.ano === ano)) }));
  const porArea = agregarPor(noPeriodo, (r) => r.area).sort((a, b) => b.dados.contratos - a.dados.contratos || b.dados.propostas - a.dados.propostas);
  const porSetor = agregarPor(noPeriodo, (r) => r.setor).sort((a, b) => b.dados.contratos - a.dados.contratos);
  const porGerente = agregarPor(noPeriodo, (r) => r.gerente, "Não informado")
    .sort((a, b) => b.dados.propostas - a.dados.propostas)
    .slice(0, 12);
  const carteira = contratadoPorCliente(noPeriodo);
  const faturamentoClientes = faturadoPorCliente(notasPeriodo);
  const creditos = situacaoCreditos(notasPeriodo);
  const tributosPorAno = new Map((fatAnual ?? []).map((f: FaturamentoAno) => [f.ano, Number(f.tributos_total)]));
  const anosNotas = [...new Set(notasPeriodo.map((n) => n.ano))].sort();
  const faturadoPorAno = anosNotas.map((ano) => notasPeriodo.filter((n) => n.ano === ano).reduce((s, n) => s + Number(n.valor), 0));

  const grupos = new Map<string, number>();
  for (const r of noPeriodo) {
    const g = r.situacao ? (GRUPO_SITUACAO[r.situacao as Situacao] ?? "sem") : "sem";
    grupos.set(g, (grupos.get(g) ?? 0) + 1);
  }

  const podeGerarIA = eAdmin(sessao.papel);
  const iaConfigurada = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  const analise = (iaSalva?.valor ?? null) as AnaliseSalva | null;
  const periodoTexto = de === ate ? String(de) : `${de}–${ate}`;

  return (
    <>
      <CabecalhoPagina
        sobre="Análise comercial"
        titulo="Resultados"
        descricao="Onde a Cooesa ganha, com quem e com que valores. Complementa o Painel com taxas por valor, desempenho por área e concentração de clientes."
      />

      <div className="pilha">
        <section className="painel">
          <Form action="/resultados" className="filtros">
            <div className="campo">
              <label htmlFor="de">De</label>
              <input id="de" name="de" type="number" min={1990} max={2100} defaultValue={de} />
            </div>
            <div className="campo">
              <label htmlFor="ate">Até</label>
              <input id="ate" name="ate" type="number" min={1990} max={2100} defaultValue={ate} />
            </div>
            <div className="atalhos">
              <button className="btn btn-primario" type="submit">
                Aplicar
              </button>
            </div>
            <nav className="atalhos busca" aria-label="Períodos prontos">
              {presets.map((p) => (
                <Link key={p.rotulo} className="atalho" href={`/resultados?de=${p.de}&ate=${p.ate}`} aria-pressed={p.de === de && p.ate === ate}>
                  {p.rotulo}
                </Link>
              ))}
            </nav>
          </Form>
        </section>

        {falhou ? <p className="aviso aviso-erro">Não foi possível carregar os dados. Recarregue a página.</p> : null}
        {ate > ultimoAnoNotas && ultimoAnoNotas > 0 ? (
          <p className="aviso aviso-alerta">
            As notas fiscais estão registradas até {ultimoAnoNotas}. Faturamento de {ultimoAnoNotas + 1} em diante aparece zerado até as notas
            serem cadastradas em Faturamento.
          </p>
        ) : null}

        <div className="indicadores">
          <Indicador rotulo={`Propostas · ${periodoTexto}`} valor={formatarInteiro(total.propostas)} detalhe={`${formatarInteiro(total.contratos)} viraram contrato`} />
          <Indicador rotulo="Sucesso por quantidade" valor={formatarPercentual(total.taxaQuantidade)} detalhe="contratos ÷ propostas" />
          <Indicador
            rotulo="Sucesso por valor (P)"
            valor={formatarPercentual(total.taxaValor)}
            detalhe="R$ contratado ÷ R$ proposto"
            destaque={total.taxaValor !== null && total.taxaQuantidade !== null && total.taxaValor < total.taxaQuantidade / 2}
          />
          <Indicador rotulo="Contratado (P)" {...moeda(total.contratadoP)} detalhe={`de ${moeda(total.propostoP).valor} propostos`} />
          <Indicador rotulo="Ticket médio contratado (P)" {...moeda(total.ticketContratadoP)} detalhe={`proposto: ${moeda(total.ticketPropostoP).valor}`} />
          <Indicador rotulo="Faturado (notas)" {...moeda(creditos.total)} detalhe={`${notasPeriodo.length} notas no período`} />
        </div>

        {total.taxaValor !== null && total.taxaQuantidade !== null && total.taxaValor < total.taxaQuantidade / 2 ? (
          <p className="aviso">
            <strong>Leitura rápida:</strong> no período, a Cooesa fecha {formatarPercentual(total.taxaQuantidade)} das propostas, mas só{" "}
            {formatarPercentual(total.taxaValor)} do valor proposto. Ganha com mais frequência as propostas menores: o ticket contratado (
            {moeda(total.ticketContratadoP).valor}) é bem menor que o proposto ({moeda(total.ticketPropostoP).valor}).
          </p>
        ) : null}

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>
              {anoRef} comparado com {anoRef - 1}
            </h2>
            <span className="nota">Último ano completo do período · {anoAtual} ainda está em andamento</span>
          </div>
          <div className="tabela-rolagem">
            <table className="tabela compacta">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th className="num">{anoRef - 1}</th>
                  <th className="num">{anoRef}</th>
                  <th className="num">Variação</th>
                </tr>
              </thead>
              <tbody>
                <LinhaComparativo rotulo="Propostas" a={antes.propostas} b={ref.propostas} fmt={formatarInteiro} />
                <LinhaComparativo rotulo="Contratos" a={antes.contratos} b={ref.contratos} fmt={formatarInteiro} />
                <LinhaComparativo rotulo="Sucesso por quantidade" a={antes.taxaQuantidade} b={ref.taxaQuantidade} fmt={formatarPercentual} pontos />
                <LinhaComparativo rotulo="Sucesso por valor (P)" a={antes.taxaValor} b={ref.taxaValor} fmt={formatarPercentual} pontos />
                <LinhaComparativo rotulo="Valor proposto (P)" a={antes.propostoP} b={ref.propostoP} fmt={formatarMoeda} />
                <LinhaComparativo rotulo="Valor contratado (P)" a={antes.contratadoP} b={ref.contratadoP} fmt={formatarMoeda} />
                <LinhaComparativo rotulo="Ticket médio contratado (P)" a={antes.ticketContratadoP} b={ref.ticketContratadoP} fmt={formatarMoeda} />
                <LinhaComparativo
                  rotulo="Faturado (notas)"
                  a={anoRef - 1 <= ultimoAnoNotas ? faturadoAno(anoRef - 1) : null}
                  b={anoRef <= ultimoAnoNotas ? faturadoAno(anoRef) : null}
                  fmt={formatarMoeda}
                />
              </tbody>
            </table>
          </div>
        </section>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Sucesso por quantidade × por valor</h2>
              <span className="nota">% ao ano · valor só de propostas P</span>
            </div>
            <div className="painel-corpo">
              <GraficoBarras
                titulo="Taxa de sucesso por quantidade e por valor, por ano"
                categorias={porAno.map((p) => String(p.ano))}
                series={[
                  { nome: "Por quantidade", classe: "serie-propostas", valores: porAno.map((p) => p.dados.taxaQuantidade ?? 0) },
                  { nome: "Por valor (P)", classe: "serie-contratos", valores: porAno.map((p) => p.dados.taxaValor ?? 0) },
                ]}
                formato="percentual"
                passoRotulo={Math.max(1, Math.ceil(anos.length / 12))}
                extras={porAno.map((p) => [`${p.dados.contratos} de ${p.dados.propostas} propostas`])}
              />
            </div>
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Ticket médio · proposto × contratado</h2>
              <span className="nota">Média por proposta P com valor</span>
            </div>
            <div className="painel-corpo">
              <GraficoBarras
                titulo="Ticket médio proposto e contratado por ano"
                categorias={porAno.map((p) => String(p.ano))}
                series={[
                  { nome: "Proposto", classe: "serie-propostas", valores: porAno.map((p) => p.dados.ticketPropostoP ?? 0) },
                  { nome: "Contratado", classe: "serie-contratos", valores: porAno.map((p) => p.dados.ticketContratadoP ?? 0) },
                ]}
                formato="moeda"
                passoRotulo={Math.max(1, Math.ceil(anos.length / 12))}
              />
            </div>
          </section>
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Desempenho por área</h2>
            <span className="nota">Onde a Cooesa é mais competitiva · {periodoTexto}</span>
          </div>
          <TabelaDesempenho
            titulo="Desempenho por área"
            rotuloChave="Área"
            linhas={porArea.map((a) => ({
              ...a,
              href: a.chave === "Sem classificação" ? undefined : `/registros?area=${encodeURIComponent(String(a.chave))}&de=${de}&ate=${ate}`,
            }))}
          />
        </section>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Por setor</h2>
            </div>
            <TabelaDesempenho titulo="Desempenho por setor" rotuloChave="Setor" linhas={porSetor} />
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Por gerente de contrato</h2>
              <span className="nota">12 com mais propostas</span>
            </div>
            <TabelaDesempenho
              titulo="Desempenho por gerente"
              rotuloChave="Gerente"
              linhas={porGerente.map((g) => ({
                ...g,
                href: g.chave === "Não informado" ? undefined : `/registros?gerente=${encodeURIComponent(String(g.chave))}&de=${de}&ate=${ate}`,
              }))}
            />
          </section>
        </div>

        <div className="grade grade-2">
          <Concentracao
            titulo="Concentração da carteira contratada"
            nota="Valor contratado (P) por cliente"
            dados={carteira}
          />
          <Concentracao titulo="Concentração do faturamento" nota="Notas ligadas a clientes cadastrados" dados={faturamentoClientes} />
        </div>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Faturamento por ano</h2>
              <span className="nota">Tributos estimados na dica · passe o mouse</span>
            </div>
            <div className="painel-corpo">
              {anosNotas.length ? (
                <GraficoBarras
                  titulo="Faturamento por ano"
                  categorias={anosNotas.map(String)}
                  series={[{ nome: "Faturado", classe: "serie-contratos", valores: faturadoPorAno }]}
                  formato="moeda"
                  altura={230}
                  extras={anosNotas.map((ano) => [`Tributos estimados: ${formatarMoeda(tributosPorAno.get(ano) ?? 0)}`])}
                />
              ) : (
                <p className="vazio">Nenhuma nota fiscal no período.</p>
              )}
            </div>
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Créditos das notas</h2>
              <span className="nota">{periodoTexto}</span>
            </div>
            <div className="painel-corpo">
              <dl className="resultado-resumo">
                <Linha rotulo="Faturado" valor={formatarMoeda(creditos.total)} />
                <Linha rotulo="Com crédito registrado" valor={formatarMoeda(creditos.creditado)} />
                <Linha
                  rotulo={`Emitidas sem crédito registrado (${creditos.qtdSemCredito})`}
                  valor={formatarMoeda(creditos.semCredito)}
                  ajuda="Podem estar pendentes ou só sem a data de crédito lançada. Confira em Faturamento."
                />
                <Linha
                  rotulo={`Sem data de emissão nem crédito (${creditos.qtdSemDados})`}
                  valor={formatarMoeda(creditos.semDados)}
                  ajuda="Notas incompletas na planilha — ver Pendências de dados."
                />
              </dl>
              <div className="atalhos" style={{ marginTop: 14 }}>
                <Link className="btn btn-pequeno" href="/faturamento">
                  Abrir Faturamento
                </Link>
                {creditos.qtdSemDados ? (
                  <Link className="btn btn-pequeno" href="/pendencias#nota_incompleta">
                    Ver notas incompletas
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Carteira por situação</h2>
            <span className="nota">{formatarInteiro(noPeriodo.length)} registros · {periodoTexto}</span>
          </div>
          <div className="painel-corpo">
            <ul className="barras-h barras-situacao">
              {ORDEM_GRUPOS.filter((g) => grupos.get(g)).map((g) => {
                const qtd = grupos.get(g) ?? 0;
                return (
                  <li key={g}>
                    <span className="rotulo-barra">{g === "sem" ? "Sem situação" : ROTULO_GRUPO[g]}</span>
                    <div className="trilho">
                      <div className={`preenchido sit-${g}`} style={{ width: `${(qtd / Math.max(1, noPeriodo.length)) * 100}%` }} />
                    </div>
                    <span className="num">
                      {formatarInteiro(qtd)} <span className="muted">· {formatarPercentual((qtd / Math.max(1, noPeriodo.length)) * 100)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {iaConfigurada || analise ? (
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Análise assistida por IA</h2>
              <span className="nota">Usa só totais agregados, sem nomes de clientes, contatos ou escopos</span>
            </div>
            <div className="painel-corpo">
              <AnaliseResultadosIA inicial={analise} podeGerar={podeGerarIA && iaConfigurada} />
            </div>
          </section>
        ) : null}

        <p className="pequeno muted">
          Regras: contrato = encerrado + em andamento (litígio não conta). Valores em R$ usam só propostas tipo P (valor total); tipo T é
          mensal e aparece à parte no Painel e nos Clientes. Dados atualizados em {formatarData(hojeBrasil().iso)}
          {analise ? ` · última análise por IA em ${formatarDataHora(analise.gerado_em)}` : ""}.
        </p>
      </div>
    </>
  );
}

function LinhaComparativo(props: { rotulo: string; a: number | null; b: number | null; fmt: (v: number | null) => string; pontos?: boolean }) {
  return (
    <tr>
      <td>{props.rotulo}</td>
      <td className="num">{props.fmt(props.a)}</td>
      <td className="num">{props.fmt(props.b)}</td>
      <td className="num">
        <Variacao valor={props.pontos ? diferencaPontos(props.b, props.a) : variacao(props.b, props.a)} pontos={props.pontos} />
      </td>
    </tr>
  );
}

function Linha({ rotulo, valor, ajuda }: { rotulo: string; valor: string; ajuda?: string }) {
  return (
    <div>
      <dt>
        {rotulo}
        {ajuda ? <span className="ajuda-linha">{ajuda}</span> : null}
      </dt>
      <dd>{valor}</dd>
    </div>
  );
}

function Concentracao({ titulo, nota, dados }: { titulo: string; nota: string; dados: ReturnType<typeof contratadoPorCliente> }) {
  return (
    <section className="painel">
      <div className="painel-cabecalho">
        <h2>{titulo}</h2>
        <span className="nota">{nota}</span>
      </div>
      {dados.ranking.length ? (
        <>
          <div className="indicadores indicadores-embutidos">
            <Indicador rotulo="5 maiores clientes" valor={formatarPercentual(dados.top5)} detalhe="do total" />
            <Indicador rotulo="10 maiores clientes" valor={formatarPercentual(dados.top10)} detalhe="do total" />
            <Indicador rotulo="Clientes com valor" valor={formatarInteiro(dados.ranking.length)} detalhe={formatarMoeda(dados.total)} />
          </div>
          <div className="tabela-rolagem">
            <table className="tabela compacta">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Valor</th>
                  <th className="num">Participação</th>
                  <th className="num">Acumulada</th>
                </tr>
              </thead>
              <tbody>
                {dados.ranking.slice(0, 10).map((c) => (
                  <tr key={c.clienteId}>
                    <td>
                      <Link href={`/clientes/${c.clienteId}`}>{c.cliente}</Link>
                    </td>
                    <td className="num">{formatarMoeda(c.valor)}</td>
                    <td className="num">{formatarPercentual(c.participacao)}</td>
                    <td className="num">{formatarPercentual(c.acumulada)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="vazio">Sem valores no período.</p>
      )}
    </section>
  );
}
