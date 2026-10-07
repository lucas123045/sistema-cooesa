import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { nomesClientes } from "@/lib/clientes";
import { carregarSugestoes } from "@/lib/registros/sugestoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormRegistro } from "../FormRegistro";

export const metadata: Metadata = { title: "Nova proposta" };

export default async function PaginaNovoRegistro(props: PageProps<"/registros/novo">) {
  await exigirSessao("editor");
  const supabase = await criarClienteServidor();
  const [clientes, sugestoes] = await Promise.all([nomesClientes(supabase), carregarSugestoes(supabase)]);
  // "Nova proposta" a partir do detalhe da empresa: ?cliente=<id> já preenche o cliente.
  const clienteId = Number((await props.searchParams).cliente);
  const clienteInicial = clientes.find((c) => c.id === clienteId)?.nome;
  return (
    <>
      <CabecalhoPagina
        sobre={<Link href="/registros">Propostas e contratos</Link>}
        titulo="Nova proposta"
        descricao="O número é atribuído automaticamente, continuando a sequência da planilha."
      />
      <div className="painel">
        <div className="painel-corpo">
          <FormRegistro clientes={clientes.map((c) => c.nome)} sugestoes={sugestoes} clienteInicial={clienteInicial} />
        </div>
      </div>
    </>
  );
}
