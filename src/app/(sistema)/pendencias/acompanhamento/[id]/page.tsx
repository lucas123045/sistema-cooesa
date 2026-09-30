import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { vincularAcompanhamento } from "./acoes";

export const metadata: Metadata = { title: "Vincular acompanhamento" };
export default async function VincularAcompanhamento(props: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await exigirSessao("editor");
  const [{ id: texto }, query] = await Promise.all([props.params, props.searchParams]);
  const id = Number(texto);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = await criarClienteServidor();
  const { data, error } = await db.from("acompanhamentos").select("id,fonte,empresa_texto,escopo_texto,obs,registro_num").eq("id", id).maybeSingle();
  if (error || !data || data.registro_num !== null) notFound();
  return <><CabecalhoPagina sobre={<Link href="/pendencias">Pendências de dados</Link>} titulo="Vincular acompanhamento antigo" descricao="Informe o número do registro correspondente. O texto original será mantido."/><section className="painel">{query.erro?<p className="aviso aviso-erro">Não foi possível vincular. Confira o número do registro e tente novamente.</p>:null}<dl className="definicoes"><div><dt>Origem</dt><dd>{data.fonte}</dd></div><div><dt>Empresa na planilha</dt><dd>{data.empresa_texto??"—"}</dd></div><div className="largo"><dt>Escopo na planilha</dt><dd>{data.escopo_texto??"—"}</dd></div><div className="largo"><dt>Anotação</dt><dd>{data.obs??"—"}</dd></div></dl><form action={vincularAcompanhamento} className="formulario painel-corpo"><input type="hidden" name="id" value={id}/><div className="campo c-6"><label htmlFor="registro_num">Número do registro</label><input id="registro_num" name="registro_num" type="number" min={1} required/><span className="ajuda">Confira o cliente e o escopo antes de salvar.</span></div><div className="campo c-12"><button className="btn btn-primario" type="submit">Vincular acompanhamento</button></div></form></section></>;
}
