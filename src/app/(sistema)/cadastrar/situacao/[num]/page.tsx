import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { SeloSituacao } from "@/components/SeloSituacao";
import { formatarData, formatarValorRegistro } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { FormSituacao } from "./FormSituacao";

export const metadata: Metadata = { title: "Atualizar situação" };

export default async function PaginaAtualizarUma(props: PageProps<"/cadastrar/situacao/[num]">) {
  await exigirSessao("editor");
  const num = Number((await props.params).num);
  if (!Number.isInteger(num) || num < 1) notFound();
  const db = await criarClienteServidor();
  const { data } = await db
    .from("registros")
    .select("num, escopo, situacao, data_ini, ano, valor, tipo, motivo_perda, clientes(nome, status)")
    .eq("num", num)
    .maybeSingle();
  if (!data) notFound();
  const r = data as unknown as {
    num: number;
    escopo: string | null;
    situacao: string | null;
    data_ini: string | null;
    ano: number;
    valor: number | null;
    tipo: "P" | "T";
    motivo_perda: string | null;
    clientes: { nome: string; status: string | null } | null;
  };

  return (
    <>
      <CabecalhoPagina
        icone="relogio"
        sobre={
          <>
            <Link href="/cadastrar/situacao">Atualizar situação</Link> · <Link href={`/registros/${num}`}>Nº {num}</Link>
          </>
        }
        titulo={`Nº ${num} · ${r.clientes?.nome ?? ""}`}
        descricao={r.escopo ?? undefined}
      />
      <div className="pilha" style={{ maxWidth: 760 }}>
        <div className="faixa-empresa">
          <div>
            <span className="rotulo">Situação atual</span>
            <div style={{ marginTop: 4 }}>
              <SeloSituacao situacao={r.situacao} />
            </div>
          </div>
          <dl className="faixa-dados">
            <div>
              <dt>Data</dt>
              <dd>{r.data_ini ? formatarData(r.data_ini) : r.ano}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{r.valor !== null ? formatarValorRegistro(Number(r.valor), r.tipo) : "—"}</dd>
            </div>
          </dl>
        </div>
        <FormSituacao
          num={num}
          situacaoAtual={r.situacao}
          statusEmpresa={r.clientes?.status ?? null}
          nomeEmpresa={r.clientes?.nome ?? ""}
        />
      </div>
    </>
  );
}
