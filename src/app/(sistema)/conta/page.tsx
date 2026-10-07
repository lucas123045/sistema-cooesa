import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { ROTULO_PAPEL } from "@/lib/papeis";
import { exigirSessao } from "@/lib/supabase/server";
import { SegundoFator } from "./SegundoFator";

export const metadata: Metadata = { title: "Minha conta" };

export default async function PaginaConta() {
  const sessao = await exigirSessao();
  return (
    <>
      <CabecalhoPagina sobre={<Link href="/">Painel de Controle</Link>} titulo="Minha conta" />
      <div className="pilha" style={{ maxWidth: 720 }}>
        <section className="painel">
          <dl className="definicoes">
            <div>
              <dt>Nome</dt>
              <dd>{sessao.nome}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{sessao.email}</dd>
            </div>
            <div>
              <dt>Papel</dt>
              <dd>{ROTULO_PAPEL[sessao.papel]}</dd>
            </div>
          </dl>
          <div className="painel-corpo">
            <Link className="btn" href="/redefinir-senha">
              Trocar senha
            </Link>
          </div>
        </section>

        <section className="painel" id="dois-passos">
          <div className="painel-cabecalho">
            <h2>Verificação em dois passos</h2>
            <span className="nota">{sessao.doisPassos ? "Ativa" : "Desativada"}</span>
          </div>
          <div className="painel-corpo">
            {sessao.papel === "admin" && !sessao.doisPassos ? (
              <p className="aviso aviso-alerta" style={{ marginBottom: 12 }}>
                Recomendado para administradores: esta conta vê e altera todos os dados da empresa.
              </p>
            ) : null}
            <SegundoFator ativo={sessao.doisPassos} />
          </div>
        </section>
      </div>
    </>
  );
}
