import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { nomesClientes } from "@/lib/clientes";
import { carregarSugestoes } from "@/lib/registros/sugestoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormRegistro } from "../FormRegistro";

export const metadata: Metadata = { title: "Nova proposta" };

export default async function PaginaNovoRegistro() {
  await exigirSessao("editor");
  const supabase = await criarClienteServidor();
  const [clientes, sugestoes] = await Promise.all([nomesClientes(supabase), carregarSugestoes(supabase)]);
  return (
    <>
      <CabecalhoPagina
        sobre={<Link href="/registros">Propostas e contratos</Link>}
        titulo="Nova proposta"
        descricao="O número é atribuído automaticamente, continuando a sequência da planilha."
      />
      <div className="painel">
        <div className="painel-corpo">
          <FormRegistro clientes={clientes.map((c) => c.nome)} sugestoes={sugestoes} />
        </div>
      </div>
    </>
  );
}
