import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { nomesClientes } from "@/lib/clientes";
import { carregarSugestoes } from "@/lib/registros/sugestoes";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Pendencia, Registro } from "@/lib/tipos";
import { FormRegistro } from "../../FormRegistro";

export async function generateMetadata(props: PageProps<"/registros/[num]/editar">): Promise<Metadata> {
  const { num } = await props.params;
  return { title: `Editar registro Nº ${num}` };
}

export default async function PaginaEditarRegistro(props: PageProps<"/registros/[num]/editar">) {
  await exigirSessao("editor");
  const num = Number((await props.params).num);
  if (!Number.isInteger(num) || num <= 0) notFound();

  const supabase = await criarClienteServidor();
  const [reg, clientes, sugestoes, pend] = await Promise.all([
    supabase.from("registros").select("*, clientes(nome)").eq("num", num).maybeSingle(),
    nomesClientes(supabase),
    carregarSugestoes(supabase),
    supabase.from("vw_pendencias").select("*").eq("registro_num", num),
  ]);
  if (!reg.data) notFound();
  const r = reg.data as Registro & { clientes: { nome: string } | null };

  return (
    <>
      <CabecalhoPagina
        sobre={
          <>
            <Link href="/registros">Propostas e contratos</Link> · <Link href={`/registros/${num}`}>Registro Nº {num}</Link>
          </>
        }
        titulo={`Editar registro Nº ${num}`}
        descricao="Textos originais da planilha ficam preservados e aparecem em âmbar abaixo dos campos. Toda alteração vai para o histórico."
      />
      <div className="painel">
        <div className="painel-corpo">
          <FormRegistro
            registro={{ ...r, cliente_nome: r.clientes?.nome ?? "" }}
            clientes={clientes.map((c) => c.nome)}
            sugestoes={sugestoes}
            pendencias={(pend.data ?? []) as Pendencia[]}
          />
        </div>
      </div>
    </>
  );
}
