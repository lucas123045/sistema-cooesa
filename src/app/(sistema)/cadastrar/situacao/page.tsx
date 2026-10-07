import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { SeloSituacao } from "@/components/SeloSituacao";
import { formatarData, formatarValorRegistro } from "@/lib/formato";
import { termosBusca } from "@/lib/registros/filtros";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { LinhaRegistroLista } from "@/lib/tipos";

export const metadata: Metadata = { title: "Atualizar situação" };

type Linha = Pick<LinhaRegistroLista, "num" | "cliente" | "escopo" | "situacao" | "data_ini" | "ano" | "valor" | "tipo">;

/** Lista as propostas em aberto (ou a busca) para escolher qual atualizar. */
export default async function PaginaAtualizarSituacao(props: PageProps<"/cadastrar/situacao">) {
  await exigirSessao("editor");
  const p = await props.searchParams;
  const q = (Array.isArray(p.q) ? p.q[0] : p.q)?.trim().slice(0, 100) ?? "";
  const db = await criarClienteServidor();

  let consulta = db.from("vw_registros").select("num, cliente, escopo, situacao, data_ini, ano, valor, tipo");
  const numero = /^\d{1,6}$/.test(q.replace(/^n[ºo°]?\s*/i, "")) ? Number(q.replace(/^n[ºo°]?\s*/i, "")) : null;
  if (numero) consulta = consulta.eq("num", numero);
  else if (q) for (const termo of termosBusca(q)) consulta = consulta.ilike("busca", `%${termo}%`);
  else consulta = consulta.in("situacao", ["Proposta colocada", "Contrato em andamento"]);
  const { data, error } = await consulta.order("num", { ascending: false }).limit(50);
  const linhas = (data ?? []) as Linha[];

  return (
    <>
      <CabecalhoPagina
        icone="relogio"
        sobre={<Link href="/cadastrar">Cadastrar</Link>}
        titulo="Atualizar situação"
        descricao="Escolha a proposta: as em aberto aparecem primeiro. Busque pelo Nº ou pelo cliente para achar outras."
      />
      <section className="painel">
        <Form action="/cadastrar/situacao" className="filtros" role="search">
          <div className="campo busca">
            <label htmlFor="q">Nº, cliente ou escopo</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Ex.: 1058 ou CPFL" />
          </div>
          <div className="atalhos">
            <button className="btn btn-primario" type="submit">
              Buscar
            </button>
            {q ? (
              <Link className="btn btn-texto" href="/cadastrar/situacao">
                Ver as em aberto
              </Link>
            ) : null}
          </div>
        </Form>
        <div className="barra-resultado">
          <span>
            {q
              ? `Resultado da busca (${linhas.length})`
              : `Em aberto: aguardando resposta e contratos em andamento (${linhas.length})`}
          </span>
        </div>
        {error ? (
          <p className="aviso aviso-erro" style={{ margin: 18 }}>
            Não foi possível carregar as propostas. Recarregue a página.
          </p>
        ) : linhas.length === 0 ? (
          <div className="vazio">
            <strong>Nenhuma proposta encontrada.</strong>
            Confira o número ou busque só parte do nome do cliente.
          </div>
        ) : (
          <ul className="lista-pendencias">
            {linhas.map((r) => (
              <li key={r.num}>
                <div>
                  <strong>
                    Nº {r.num} · {r.cliente}
                  </strong>
                  <p>{r.escopo ?? "sem escopo"}</p>
                  <p className="pequeno">
                    {r.data_ini ? formatarData(r.data_ini) : r.ano}
                    {r.valor !== null ? ` · ${formatarValorRegistro(Number(r.valor), r.tipo)}` : ""}
                  </p>
                </div>
                <div className="atalhos">
                  <SeloSituacao situacao={r.situacao} />
                  <Link className="btn btn-primario btn-pequeno" href={`/cadastrar/situacao/${r.num}`}>
                    Atualizar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
