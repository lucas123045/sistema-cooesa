import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { lerTudo } from "@/lib/consultas";
import { hojeBrasil } from "@/lib/formato";
import { carregarSugestoes } from "@/lib/registros/sugestoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { AssistenteProposta, type EmpresaOpcao, type PropostaRecente } from "./AssistenteProposta";

export const metadata: Metadata = { title: "Cadastrar proposta" };

export default async function PaginaCadastrarProposta(props: PageProps<"/cadastrar/proposta">) {
  await exigirSessao("editor");
  const db = await criarClienteServidor();
  const hoje = hojeBrasil();
  const [empresas, sugestoes, recentes] = await Promise.all([
    lerTudo<EmpresaOpcao>((a, b) => db.from("clientes").select("id, nome, status").order("nome").range(a, b)),
    carregarSugestoes(db),
    // Propostas dos últimos 2 anos, para avisar de cadastro repetido.
    lerTudo<PropostaRecente>((a, b) =>
      db
        .from("vw_registros")
        .select("num, cliente, escopo, ano")
        .gte("ano", hoje.ano - 2)
        .order("num", { ascending: false })
        .range(a, b),
    ),
  ]);
  const clienteId = Number((await props.searchParams).cliente);
  const clienteInicial = empresas.find((e) => e.id === clienteId)?.nome ?? "";

  return (
    <>
      <CabecalhoPagina
        icone="propostas"
        sobre={<Link href="/cadastrar">Cadastrar</Link>}
        titulo="Nova proposta"
        descricao="Quatro etapas curtas. O rascunho fica salvo neste aparelho enquanto você preenche."
      />
      <AssistenteProposta
        empresas={empresas}
        sugestoes={sugestoes}
        recentes={recentes}
        clienteInicial={clienteInicial}
        hoje={hoje.iso}
      />
    </>
  );
}
