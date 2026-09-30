import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { formatarValorRegistro } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { BotaoImprimir } from "./BotaoImprimir";
import type { LinhaCurriculo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Currículo técnico" };
type Search = Record<string, string | string[] | undefined>;
function valor(p: Search, chave: string) { const x = p[chave]; return (Array.isArray(x) ? x[0] : x)?.trim() ?? ""; }

export default async function Curriculo(props: { searchParams: Promise<Search> }) {
  await exigirSessao();
  const p = await props.searchParams;
  const f = { setor: valor(p,"setor"), area: valor(p,"area"), empreendimento: valor(p,"empreendimento"), servico: valor(p,"servico"), especialidade: valor(p,"especialidade"), de: valor(p,"de"), ate: valor(p,"ate"), andamento: valor(p,"andamento")==="1", valores: valor(p,"valores")==="1" };
  const db = await criarClienteServidor();
  const { data, error } = await db.from("vw_curriculo").select("*").order("ano",{ascending:false}).order("num",{ascending:false});
  const todos = (data ?? []) as LinhaCurriculo[];
  const linhas = todos.filter(x => (f.andamento || x.situacao==="Contrato encerrado") && (!f.setor||x.setor===f.setor) && (!f.area||x.area===f.area) && (!f.empreendimento||x.empreendimento===f.empreendimento) && (!f.servico||x.servico===f.servico) && (!f.especialidade||x.especialidade===f.especialidade) && (!f.de||x.ano>=Number(f.de)) && (!f.ate||x.ano<=Number(f.ate)));
  const opcoes = (campo:keyof LinhaCurriculo, pai?:keyof LinhaCurriculo, selecionado?:string) => [...new Set(todos.filter(x=>!pai||!selecionado||x[pai]===selecionado).map(x=>x[campo]).filter((v):v is string=>typeof v==="string"&&!!v))].sort();
  type CampoFiltro=[string,string,keyof LinhaCurriculo,(keyof LinhaCurriculo)?,string?];
  const campos:CampoFiltro[]=[["setor","Setor","setor"],["area","Área","area","setor",f.setor],["empreendimento","Empreendimento","empreendimento","area",f.area],["servico","Serviço","servico","empreendimento",f.empreendimento],["especialidade","Especialidade","especialidade","servico",f.servico]];
  const qs=new URLSearchParams(); for(const [k,v] of Object.entries(f)) if(v) qs.set(k,typeof v==="boolean"?"1":String(v));
  return <><CabecalhoPagina sobre="Experiência comprovada" titulo="Currículo técnico" descricao="Contratos encerrados por padrão; inclua os em andamento quando precisar." acoes={<><a className="btn" href={"/curriculo/exportar?"+qs.toString()}>Exportar Excel</a><BotaoImprimir/></>}/><section className="painel"><Form action="/curriculo" className="filtros">{campos.map(([n,label,key,pai,sel])=><div className="campo" key={n}><label htmlFor={n}>{label}</label><select id={n} name={n} defaultValue={f[n as keyof typeof f] as string}><option value="">Todos</option>{opcoes(key,pai,sel).map(v=><option key={v}>{v}</option>)}</select></div>)}<div className="campo"><label htmlFor="de">Ano de</label><input id="de" name="de" type="number" min="1990" max="2100" defaultValue={f.de}/></div><div className="campo"><label htmlFor="ate">Ano até</label><input id="ate" name="ate" type="number" min="1990" max="2100" defaultValue={f.ate}/></div><label className="checagem"><input type="checkbox" name="andamento" value="1" defaultChecked={f.andamento}/> Incluir contratos em andamento</label><label className="checagem"><input type="checkbox" name="valores" value="1" defaultChecked={f.valores}/> Exibir valores</label><button className="btn btn-primario" type="submit">Filtrar</button></Form><div className="painel-cabecalho"><strong>{linhas.length} experiências</strong></div>{error?<p className="aviso aviso-erro">Não foi possível carregar os contratos. Confira as migrações.</p>:<div className="tabela-rolagem"><table className="tabela"><thead><tr><th>Ano</th><th>Cliente e escopo</th><th>Classificação</th><th>Situação</th>{f.valores?<th className="num">Valor</th>:null}</tr></thead><tbody>{linhas.map(x=><tr key={x.num}><td>{x.ano}</td><td><Link href={"/registros/"+x.num}><strong>{x.cliente}</strong></Link><span className="sub">{x.escopo}</span></td><td>{[x.setor,x.area,x.empreendimento,x.servico,x.especialidade].filter(Boolean).join(" / ")||"—"}</td><td>{x.situacao}</td>{f.valores?<td className="num">{x.valor===null?"—":formatarValorRegistro(Number(x.valor),x.tipo)}</td>:null}</tr>)}</tbody></table></div>}</section></>;
}
