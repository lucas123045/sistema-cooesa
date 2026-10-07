import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { opcoesFormEmpresa } from "@/lib/empresas-opcoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormEmpresa } from "../FormEmpresa";

export const metadata: Metadata = { title: "Nova empresa" };

export default async function PaginaNovaEmpresa() {
  await exigirSessao("editor");
  const opcoes = await opcoesFormEmpresa(await criarClienteServidor());
  return (
    <>
      <CabecalhoPagina icone="clientes" sobre={<Link href="/clientes">Empresas</Link>} titulo="Nova empresa" />
      <div className="painel">
        <div className="painel-corpo">
          <FormEmpresa {...opcoes} podeRenomear />
        </div>
      </div>
    </>
  );
}
