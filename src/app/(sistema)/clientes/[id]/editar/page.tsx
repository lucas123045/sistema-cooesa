import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { opcoesFormEmpresa } from "@/lib/empresas-opcoes";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaCliente } from "@/lib/tipos";
import { FormEmpresa } from "../../FormEmpresa";

export const metadata: Metadata = { title: "Editar empresa" };

export default async function PaginaEditarEmpresa(props: PageProps<"/clientes/[id]/editar">) {
  const sessao = await exigirSessao("editor");
  const id = Number((await props.params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const db = await criarClienteServidor();
  const [{ data }, opcoes] = await Promise.all([
    db.from("vw_clientes").select("*").eq("id", id).maybeSingle(),
    opcoesFormEmpresa(db),
  ]);
  if (!data) notFound();
  const empresa = data as LinhaCliente;
  return (
    <>
      <CabecalhoPagina
        icone="clientes"
        sobre={
          <>
            <Link href="/clientes">Empresas</Link> · <Link href={`/clientes/${id}`}>{empresa.nome}</Link>
          </>
        }
        titulo={`Editar ${empresa.nome}`}
        descricao="Toda alteração vai para o histórico da empresa."
      />
      <div className="painel">
        <div className="painel-corpo">
          <FormEmpresa empresa={empresa} {...opcoes} podeRenomear={eAdmin(sessao.papel)} />
        </div>
      </div>
    </>
  );
}
