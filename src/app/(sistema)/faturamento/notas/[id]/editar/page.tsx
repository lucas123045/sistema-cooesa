import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { nomesClientes } from "@/lib/clientes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormNota } from "../../../FormNota";

export const metadata: Metadata = { title: "Editar nota fiscal" };
export default async function EditarNota(props: { params: Promise<{ id: string }> }) {
  await exigirSessao("editor");
  const { id: texto } = await props.params;
  const id = Number(texto);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = await criarClienteServidor();
  const [{ data: nota }, clientes] = await Promise.all([
    db
      .from("vw_notas")
      .select(
        "id,numero,data_emissao,data_credito,cliente_id,empresa_texto,titulo,valor,ano,registro_num,origem_aba,origem_linha",
      )
      .eq("id", id)
      .maybeSingle(),
    nomesClientes(db),
  ]);
  if (!nota) notFound();
  return (
    <>
      <CabecalhoPagina
        sobre={<Link href="/faturamento">Faturamento</Link>}
        titulo={`Editar nota ${nota.numero ?? id}`}
        descricao="A alteração será registrada no histórico de auditoria."
      />
      <section className="painel">
        <FormNota nota={nota} clientes={clientes} />
      </section>
    </>
  );
}
