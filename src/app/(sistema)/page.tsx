import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { SeloSituacao } from "@/components/SeloSituacao";
import { formatarInteiro, formatarMoedaCompacta, formatarPercentual } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Resumo, ResumoAnual } from "@/lib/tipos";

type LinhaPainel = { num: number; cliente: string; escopo: string | null; situacao: string | null; ano: number };

export default async function Painel() {
  const sessao = await exigirSessao();
  const db = await criarClienteServidor();
  const [resumo, anuais, faturamento, aguardando, andamento, clientes, registrosArea] = await Promise.all([
    db.from("vw_resumo").select("*").maybeSingle(),
    db.from("vw_resumo_anual").select("*").order("ano"),
    db.from("vw_faturamento_mensal").select("ano,mes,total"),
    db.from("vw_registros").select("num,cliente,escopo,situacao,ano").eq("situacao", "Aguardando resposta").order("ano", { ascending: false }).limit(5),
    db.from("vw_registros").select("num,cliente,escopo,situacao,ano").eq("situacao", "Contrato em andamento").order("ano", { ascending: false }).limit(5),
    db.from("vw_clientes").select("id,nome,contratos").gt("contratos", 0).order("contratos", { ascending: false }).limit(5),
    db.from("vw_registros").select("area").eq("situacao", "Contrato encerrado"),
  ]);
  const x = resumo.data as Resumo | null;
  const anos = (anuais.data ?? []) as ResumoAnual[];
  const agora = new Date();
  const mesAtual = agora.getFullYear() * 12 + agora.getMonth() + 1;
  const totalFaturado = (faturamento.data ?? []).filter((linha) => linha.mes !== null && linha.ano * 12 + linha.mes > mesAtual - 12).reduce((total, linha) => total + Number(linha.total), 0);
  const maxPropostas = Math.max(1, ...anos.map((linha) => linha.propostas));
  const porArea = new Map<string, number>();
  for (const registro of registrosArea.data ?? []) {
    const area = registro.area?.trim() || "Não classificada";
    porArea.set(area, (porArea.get(area) ?? 0) + 1);
  }
  const areas = [...porArea].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxArea = Math.max(1, ...areas.map(([, total]) => total));

  return <>
    <CabecalhoPagina sobre="Painel executivo" titulo={`Olá, ${sessao.nome}`} descricao="A trajetória comercial e técnica da Cooesa desde 2000." />
    {!x ? <p className="aviso aviso-alerta">Resumo indisponível. Confira a conexão Supabase e as migrações.</p> : <>
      <div className="grade grade-3 indicadores">
        <Card nome="Contratos totais" valor={formatarInteiro(x.contratos_totais)} detalhe={`${x.encerrados} encerrados · ${x.em_andamento} em andamento`} />
        <Card nome="Sucesso das cotações" valor={formatarPercentual(x.pct_sucesso === null ? null : Number(x.pct_sucesso))} detalhe={`${x.total_propostas} propostas`} />
        <Card nome="Contratos em andamento" valor={formatarInteiro(x.em_andamento)} detalhe="Contratos ativos" />
        <Card nome="Aguardando resposta" valor={formatarInteiro(x.aguardando)} detalhe="Propostas sem retorno" />
        <Card nome="Faturamento · 12 meses" valor={formatarMoedaCompacta(totalFaturado)} detalhe="Soma das notas fiscais" />
        <Card nome="Em litígio" valor={formatarInteiro(x.em_litigio)} detalhe="Propostas e contratos" />
      </div>

      <section className="painel" style={{ marginTop: 18 }}>
        <div className="painel-cabecalho"><h2>Trajetória da empresa</h2><span className="nota">Propostas e contratos por ano</span></div>
        <div className="painel-corpo" style={{ overflowX: "auto" }}><div className="linha-tempo-anos">
          {anos.filter((linha) => linha.ano >= 2000).map((linha) => <div className="coluna-ano" key={linha.ano} title={`${linha.ano}: ${linha.propostas} propostas, ${linha.contratos} contratos`}>
            <div className="barra-ano" style={{ height: `${Math.max(linha.propostas ? 4 : 1, linha.propostas / maxPropostas * 100)}%` }}><span style={{ height: `${linha.propostas ? linha.contratos / linha.propostas * 100 : 0}%` }} /></div>
            <small>{linha.ano % 5 === 0 || linha.ano === agora.getFullYear() ? linha.ano : ""}</small>
          </div>)}
        </div></div>
      </section>

      <div className="grade grade-2" style={{ marginTop: 18 }}>
        <ListaRegistros titulo="Aguardando resposta" href="/registros?atalho=aguardando" link="Ver propostas" linhas={(aguardando.data ?? []) as LinhaPainel[]} />
        <ListaRegistros titulo="Contratos em andamento" href="/registros?situacao=Contrato+em+andamento" link="Ver contratos" linhas={(andamento.data ?? []) as LinhaPainel[]} />
      </div>
      <div className="grade grade-2" style={{ marginTop: 18 }}>
        <section className="painel"><div className="painel-cabecalho"><h2>Principais clientes</h2><Link href="/clientes">Ver clientes</Link></div>
          {(clientes.data ?? []).length ? <ul className="lista-painel">{(clientes.data ?? []).map((cliente) => <li key={cliente.id}><Link href={`/clientes/${cliente.id}`}>{cliente.nome}</Link><span>{formatarInteiro(cliente.contratos)} contratos</span></li>)}</ul> : <p className="painel-corpo nota">Nenhum cliente com contrato cadastrado.</p>}
        </section>
        <section className="painel"><div className="painel-cabecalho"><h2>Contratos por área</h2><Link href="/curriculo">Currículo técnico</Link></div>
          {areas.length ? <ul className="barras-h">{areas.map(([area, total]) => <li key={area}><span className="rotulo-barra" title={area}>{area}</span><div className="trilho"><div className="preenchido" style={{ width: `${total / maxArea * 100}%` }} /></div><span className="num">{formatarInteiro(total)}</span></li>)}</ul> : <p className="painel-corpo nota">Ainda não há contratos classificados por área.</p>}
        </section>
      </div>
      <section className="painel" style={{ marginTop: 18 }}><div className="painel-cabecalho"><h2>Resumo do acervo</h2><Link href="/clientes">Clientes</Link></div>
        <p className="painel-corpo">{x.clientes_distintos} clientes · {x.clientes_contrataram} contrataram · {x.sem_situacao} sem situação · {x.tipo_t} registros tipo T (valor mensal).</p>
      </section>
    </>}
  </>;
}

function ListaRegistros({ titulo, href, link, linhas }: { titulo: string; href: string; link: string; linhas: LinhaPainel[] }) {
  return <section className="painel"><div className="painel-cabecalho"><h2>{titulo}</h2><Link href={href}>{link}</Link></div>
    {linhas.length ? <ul className="lista-painel">{linhas.map((linha) => <li key={linha.num}><div><Link href={`/registros/${linha.num}`}><strong>{linha.cliente}</strong></Link><span className="sub">{linha.num} · {linha.ano}{linha.escopo ? ` · ${linha.escopo}` : ""}</span></div><SeloSituacao situacao={linha.situacao} /></li>)}</ul> : <p className="painel-corpo nota">Nenhum registro nesta situação.</p>}
  </section>;
}

function Card({ nome, valor, detalhe }: { nome: string; valor: string; detalhe: string }) {
  return <section className="painel indicador"><div className="indicador-rotulo">{nome}</div><div className="indicador-valor">{valor}</div><div className="indicador-detalhe">{detalhe}</div></section>;
}
