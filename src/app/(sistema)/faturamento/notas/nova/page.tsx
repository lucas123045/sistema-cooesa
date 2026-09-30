import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { nomesClientes } from "@/lib/clientes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormNota } from "../../FormNota";

export const metadata: Metadata = { title: "Nova nota fiscal" };
export default async function NovaNota() {
  await exigirSessao("editor");
  const db = await criarClienteServidor();
  const clientes = await nomesClientes(db);
  return <><CabecalhoPagina sobre={<Link href="/faturamento">Faturamento</Link>} titulo="Nova nota fiscal" descricao="Registre a nota e, quando possível, relacione-a a um cliente e a uma proposta." /><section className="painel"><FormNota clientes={clientes} /></section></>;
}
