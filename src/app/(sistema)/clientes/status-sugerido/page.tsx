import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { SeloStatusEmpresa } from "@/components/SeloStatusEmpresa";
import { lerTudo } from "@/lib/consultas";
import { STATUS_EMPRESA } from "@/lib/empresas";
import { formatarInteiro } from "@/lib/formato";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { aplicarSugestoes } from "../acoes";

export const metadata: Metadata = { title: "Aplicar status sugerido" };

const REGRAS = [
  ["Tem contrato em andamento", "Cliente ativo"],
  ["Tem proposta aguardando resposta", "Proposta em andamento"],
  ["Teve contrato nos últimos 3 anos", "Cliente ativo"],
  ["Teve contrato há mais tempo", "Cliente inativo"],
  ["Nunca contratou", "Prospecção"],
] as const;

/** Prévia da aplicação em lote: quantas empresas vão para cada status. Só admin. */
export default async function PaginaStatusSugerido(props: PageProps<"/clientes/status-sugerido">) {
  await exigirSessao("admin");
  const q = await props.searchParams;
  const db = await criarClienteServidor();
  const pendentes = await lerTudo<{ status_sugerido: string }>((a, b) =>
    db.from("vw_clientes").select("status_sugerido").is("status", null).range(a, b),
  ).catch(() => []);
  const porStatus = new Map<string, number>();
  for (const p of pendentes) porStatus.set(p.status_sugerido, (porStatus.get(p.status_sugerido) ?? 0) + 1);

  return (
    <>
      <CabecalhoPagina
        icone="clientes"
        sobre={<Link href="/clientes">Empresas</Link>}
        titulo="Aplicar status sugerido"
        descricao="Grava o status sugerido nas empresas que ainda não têm status. Empresas já classificadas por alguém nunca são alteradas."
      />
      <div className="pilha" style={{ maxWidth: 760 }}>
        {q.erro ? <p className="aviso aviso-erro">As sugestões não foram aplicadas. Tente de novo.</p> : null}
        {pendentes.length === 0 ? (
          <div className="painel vazio">
            <strong>Todas as empresas já têm status.</strong>
            <Link href="/clientes">Voltar para Empresas</Link>
          </div>
        ) : (
          <>
            <section className="painel">
              <div className="painel-cabecalho">
                <h2>O que vai acontecer</h2>
                <span className="nota">{formatarInteiro(pendentes.length)} empresas sem status</span>
              </div>
              <ul className="lista-painel">
                {STATUS_EMPRESA.filter((s) => porStatus.get(s)).map((s) => (
                  <li key={s}>
                    <SeloStatusEmpresa status={s} />
                    <span>{formatarInteiro(porStatus.get(s) ?? 0)} empresas</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="painel">
              <div className="painel-cabecalho">
                <h2>Regra usada</h2>
                <span className="nota">a primeira que se aplica vale</span>
              </div>
              <ol className="lista-painel" style={{ paddingLeft: 0 }}>
                {REGRAS.map(([quando, status]) => (
                  <li key={quando}>
                    <span>{quando}</span>
                    <SeloStatusEmpresa status={status} />
                  </li>
                ))}
              </ol>
            </section>
            <form action={aplicarSugestoes} className="atalhos">
              <label className="checagem">
                <input type="checkbox" name="confirmo" value="1" required /> Revisei e quero aplicar
              </label>
              <button className="btn btn-primario" type="submit">
                Aplicar a {formatarInteiro(pendentes.length)} empresas
              </button>
              <Link className="btn btn-texto" href="/clientes?status=sem">
                Ver as empresas antes
              </Link>
            </form>
            <p className="pequeno muted">
              Cada mudança fica no histórico da empresa, com o seu nome. Depois dá para ajustar uma a uma.
            </p>
          </>
        )}
      </div>
    </>
  );
}
