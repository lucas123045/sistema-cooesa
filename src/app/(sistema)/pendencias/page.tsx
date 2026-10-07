import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { lerTudo } from "@/lib/consultas";
import { podeEditar } from "@/lib/papeis";
import { ORDEM_TIPO_PENDENCIA, PENDENCIAS_SO_CORRECAO, ROTULO_TIPO_PENDENCIA } from "@/lib/rotulos";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Pendencia } from "@/lib/tipos";
import { marcarRevisada } from "./acoes";

export const metadata: Metadata = { title: "Pendências de dados" };

/** Texto do botão de revisão conforme o tipo (deixa claro o que se está afirmando). */
const ROTULO_REVISAR: Record<string, string> = {
  cliente_duplicado: "São clientes diferentes",
  cliente_unificado: "Confirmar unificação",
  faturamento_divergente: "Conferido",
  data_encerramento: "Data confere",
  valor_texto: "Sem valor numérico",
};

const ROTULO_ABRIR: Record<string, string> = {
  cliente_duplicado: "Unificar…",
  acompanhamento_nao_vinculado: "Vincular…",
  faturamento_divergente: "Ver faturamento",
};

const ERROS: Record<string, string> = {
  permissao: "Seu papel não permite revisar pendências.",
  tipo: "Esta pendência só some corrigindo o dado.",
  salvar: "A revisão não foi gravada. Tente de novo.",
};

export default async function PaginaPendencias(props: PageProps<"/pendencias">) {
  const sessao = await exigirSessao();
  const q = await props.searchParams;
  const db = await criarClienteServidor();

  let pendencias: Pendencia[] = [];
  let falhou = false;
  try {
    pendencias = await lerTudo<Pendencia>((de, ate) =>
      db.from("vw_pendencias").select("*").order("tipo").order("referencia").range(de, ate),
    );
  } catch {
    falhou = true;
  }

  const grupos = ORDEM_TIPO_PENDENCIA.map((tipo) => ({ tipo, itens: pendencias.filter((p) => p.tipo === tipo) })).filter(
    (g) => g.itens.length,
  );
  const editor = podeEditar(sessao.papel);
  const erro = typeof q.erro === "string" ? ERROS[q.erro] : null;

  return (
    <>
      <CabecalhoPagina
        sobre="Qualidade do acervo"
        icone="pendencias"
        titulo="Pendências de dados"
        descricao="Inconsistências herdadas da planilha. O original nunca é apagado: corrija o dado ou confirme que está certo, e a pendência some."
      />

      <div className="pilha">
        {erro ? <p className="aviso aviso-erro">{erro}</p> : null}
        {falhou ? <p className="aviso aviso-erro">Não foi possível carregar as pendências. Recarregue a página.</p> : null}

        {!falhou && !grupos.length ? (
          <div className="painel vazio">
            <strong>Acervo em dia.</strong>
            Nenhuma pendência aberta.
          </div>
        ) : null}

        {grupos.length ? (
          <nav className="atalhos" aria-label="Tipos de pendência">
            {grupos.map((g) => (
              <a key={g.tipo} className="atalho" href={`#${g.tipo}`}>
                {ROTULO_TIPO_PENDENCIA[g.tipo]} · {g.itens.length}
              </a>
            ))}
          </nav>
        ) : null}

        {grupos.map((g) => (
          <section className="painel" key={g.tipo} id={g.tipo}>
            <div className="painel-cabecalho">
              <h2>{ROTULO_TIPO_PENDENCIA[g.tipo]}</h2>
              <span className="nota">
                {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                {PENDENCIAS_SO_CORRECAO.has(g.tipo) ? " · some quando o dado for corrigido" : ""}
              </span>
            </div>
            <ul className="lista-pendencias">
              {g.itens.map((p) => (
                <li key={p.tipo + p.chave}>
                  <div>
                    <strong>{p.referencia}</strong>
                    <p>{p.descricao}</p>
                  </div>
                  <div className="atalhos">
                    {p.link ? (
                      <Link className="btn btn-pequeno" href={p.link}>
                        {ROTULO_ABRIR[p.tipo] ?? (editor ? "Corrigir" : "Abrir")}
                      </Link>
                    ) : null}
                    {editor && !PENDENCIAS_SO_CORRECAO.has(p.tipo) ? (
                      <form action={marcarRevisada}>
                        <input type="hidden" name="tipo" value={p.tipo} />
                        <input type="hidden" name="chave" value={p.chave} />
                        <button className="btn btn-pequeno" type="submit">
                          {ROTULO_REVISAR[p.tipo] ?? "Marcar revisada"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
