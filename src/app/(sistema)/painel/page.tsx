import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { GraficoBarras, GraficoLinha } from "@/components/graficos";
import { SeloSituacao } from "@/components/SeloSituacao";
import { formatarData, formatarInteiro, formatarMoeda, formatarPercentual } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Resumo, ResumoAnual } from "@/lib/tipos";

type LinhaLista = { num: number; cliente: string; escopo: string | null; situacao: string | null; ano: number };

/** Data de hoje menos 12 meses, em aaaa-mm-dd. */
function haDozeMeses(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export const metadata: Metadata = { title: "Painel executivo" };

export default async function Painel() {
  await exigirSessao();
  const db = await criarClienteServidor();
  const colunasLista = "num, cliente, escopo, situacao, ano";
  const [resumo, anuais, notas12, ultimaNota, aguardando, andamento, clientes, contratosArea] = await Promise.all([
    db.from("vw_resumo").select("*").maybeSingle(),
    db.from("vw_resumo_anual").select("*").order("ano"),
    db.from("notas_fiscais").select("valor").gte("data_emissao", haDozeMeses()),
    db.from("notas_fiscais").select("data_emissao").not("data_emissao", "is", null).order("data_emissao", { ascending: false }).limit(1),
    db.from("vw_registros").select(colunasLista).eq("situacao", "Proposta colocada").order("num", { ascending: false }).limit(6),
    db.from("vw_registros").select(colunasLista).eq("situacao", "Contrato em andamento").order("num", { ascending: false }).limit(6),
    db.from("vw_clientes").select("id, nome, contratos, valor_contratado_p").gt("contratos", 0).order("contratos", { ascending: false }).limit(8),
    db.from("vw_curriculo").select("area"),
  ]);

  const r = resumo.data as Resumo | null;
  if (!r) {
    return (
      <>
        <CabecalhoPagina sobre={<Link href="/">Início</Link>} titulo="Painel executivo" />
        <p className="aviso aviso-erro">
          Não foi possível carregar o resumo ({resumo.error?.message ?? "sem resposta do banco"}). Confira se as migrações foram
          aplicadas e se a carga (npm run seed) foi feita.
        </p>
      </>
    );
  }

  const anos = (anuais.data ?? []) as ResumoAnual[];
  const faturado12 = (notas12.data ?? []).reduce((s, n) => s + Number(n.valor), 0);
  const dataUltimaNota = (ultimaNota.data?.[0]?.data_emissao as string | undefined) ?? null;

  const porArea = new Map<string, number>();
  for (const c of contratosArea.data ?? []) {
    const area = (c.area as string | null)?.trim() || "Sem classificação";
    porArea.set(area, (porArea.get(area) ?? 0) + 1);
  }
  const areas = [...porArea].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxArea = Math.max(1, ...areas.map(([, n]) => n));

  const categorias = anos.map((a) => String(a.ano));
  // Ano em que todas as propostas ainda aguardam resposta (ex.: o ano corrente) fica sem taxa, em vez de 0%.
  const taxas = anos.map((a) => (a.propostas - a.aguardando > 0 ? (a.contratos / a.propostas) * 100 : null));

  return (
    <>
      <CabecalhoPagina
        sobre={<Link href="/">Início</Link>}
        titulo="Painel executivo"
        descricao={`${r.primeiro_ano ?? 2000}–${new Date().getFullYear()}: ${formatarInteiro(r.total_propostas)} propostas, ${formatarInteiro(r.contratos_totais)} contratos.`}
      />

      <div className="pilha">
        <div className="indicadores">
          <Indicador rotulo="Contratos totais" valor={formatarInteiro(r.contratos_totais)} detalhe={`${r.encerrados} encerrados · ${r.em_andamento} em andamento`} />
          <Indicador
            rotulo="Sucesso das cotações"
            valor={formatarPercentual(r.pct_sucesso === null ? null : Number(r.pct_sucesso))}
            detalhe={`contratos ÷ ${formatarInteiro(r.total_propostas)} propostas`}
          />
          <Indicador rotulo="Em andamento" valor={formatarInteiro(r.em_andamento)} detalhe="contratos ativos" href="/registros?situacao=Contrato+em+andamento" />
          <Indicador rotulo="Aguardando resposta" valor={formatarInteiro(r.aguardando)} detalhe="propostas colocadas" destaque={r.aguardando > 0} href="/registros?atalho=aguardando" />
          <Indicador
            rotulo="Faturamento 12 meses"
            valor={formatarMoeda(faturado12)}
            detalhe={dataUltimaNota ? `última nota em ${formatarData(dataUltimaNota)}` : "nenhuma nota registrada"}
            menor
          />
          <Indicador rotulo="Em litígio" valor={formatarInteiro(r.em_litigio)} detalhe="propostas e contratos" href="/registros?atalho=litigio" />
        </div>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>{new Date().getFullYear() - (r.primeiro_ano ?? 2000)} anos de Cooesa</h2>
            <span className="nota">Propostas e contratos por ano · passe o mouse para ver os números</span>
          </div>
          <div className="painel-corpo">
            <GraficoBarras
              titulo="Propostas e contratos por ano"
              categorias={categorias}
              series={[
                { nome: "Propostas", classe: "serie-propostas", valores: anos.map((a) => a.propostas) },
                { nome: "Contratos", classe: "serie-contratos", valores: anos.map((a) => a.contratos) },
              ]}
              formato="inteiro"
              passoRotulo={2}
              extras={anos.map((a) => [
                `Sucesso: ${a.propostas ? formatarPercentual((a.contratos / a.propostas) * 100) : "—"}`,
                ...(a.aguardando ? [`Aguardando: ${a.aguardando}`] : []),
              ])}
            />
            <h3 style={{ margin: "18px 0 6px" }}>Taxa de sucesso por ano</h3>
            <GraficoLinha
              titulo="Taxa de sucesso das cotações por ano"
              categorias={categorias}
              valores={taxas}
              nome="Sucesso"
              formato="percentual"
              passoRotulo={2}
              teto={100}
            />
          </div>
        </section>

        <div className="grade grade-2">
          <Lista titulo="Aguardando resposta" href="/registros?atalho=aguardando" linhas={(aguardando.data ?? []) as LinhaLista[]} vazio="Nenhuma proposta aguardando resposta." />
          <Lista
            titulo="Contratos em andamento"
            href="/registros?situacao=Contrato+em+andamento"
            linhas={(andamento.data ?? []) as LinhaLista[]}
            vazio="Nenhum contrato em andamento."
          />
        </div>

        <div className="grade grade-2">
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Principais clientes</h2>
              <Link href="/clientes?ordem=contratos">Ver todos</Link>
            </div>
            <ul className="lista-painel">
              {(clientes.data ?? []).map((c) => (
                <li key={c.id as number}>
                  <div>
                    <Link href={`/clientes/${c.id}`}>{c.nome as string}</Link>
                    <span className="sub">{formatarMoeda(Number(c.valor_contratado_p))} contratados (P)</span>
                  </div>
                  <span>{formatarInteiro(c.contratos as number)} contratos</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="painel">
            <div className="painel-cabecalho">
              <h2>Contratos por área</h2>
              <Link href="/curriculo?andamento=1">Currículo</Link>
            </div>
            <div className="painel-corpo">
              <ul className="barras-h">
                {areas.map(([area, n]) => (
                  <li key={area}>
                    <span className="rotulo-barra" title={area}>
                      {area}
                    </span>
                    <div className="trilho">
                      <div className="preenchido" style={{ width: `${(n / maxArea) * 100}%` }} />
                    </div>
                    <span className="num">{formatarInteiro(n)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Indicador(props: { rotulo: string; valor: string; detalhe: string; destaque?: boolean; menor?: boolean; href?: string }) {
  const conteudo = (
    <>
      <div className="indicador-rotulo">{props.rotulo}</div>
      <div className={`indicador-valor${props.menor ? " menor" : ""}`}>{props.valor}</div>
      <div className="indicador-detalhe">{props.detalhe}</div>
    </>
  );
  return (
    <div className={`indicador${props.destaque ? " destaque" : ""}`}>
      {props.href ? (
        <Link href={props.href} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
          {conteudo}
        </Link>
      ) : (
        conteudo
      )}
    </div>
  );
}

function Lista({ titulo, href, linhas, vazio }: { titulo: string; href: string; linhas: LinhaLista[]; vazio: string }) {
  return (
    <section className="painel">
      <div className="painel-cabecalho">
        <h2>{titulo}</h2>
        <Link href={href}>Ver todos</Link>
      </div>
      {linhas.length ? (
        <ul className="lista-painel">
          {linhas.map((l) => (
            <li key={l.num}>
              <div>
                <Link href={`/registros/${l.num}`}>
                  <strong>{l.cliente}</strong>
                </Link>
                <span className="sub">
                  Nº {l.num} · {l.ano}
                  {l.escopo ? ` · ${l.escopo}` : ""}
                </span>
              </div>
              <SeloSituacao situacao={l.situacao} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="vazio">{vazio}</p>
      )}
    </section>
  );
}
