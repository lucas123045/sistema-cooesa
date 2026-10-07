import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Icone, type NomeIcone } from "@/components/Icone";
import { exigirSessao } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cadastrar" };

type Opcao = { href: string; icone: NomeIcone; titulo: string; descricao: string };

const PRINCIPAL: Opcao = {
  href: "/cadastrar/proposta",
  icone: "propostas",
  titulo: "Nova proposta",
  descricao: "Cliente, objeto técnico, valores e situação, em quatro etapas curtas.",
};

const OPCOES: Opcao[] = [
  {
    href: "/cadastrar/situacao",
    icone: "relogio",
    titulo: "Atualizar situação",
    descricao: "Proposta ganha, perdida ou encerrada — com anotação e motivo.",
  },
  {
    href: "/clientes/nova",
    icone: "clientes",
    titulo: "Nova empresa",
    descricao: "Cliente ou empresa em prospecção, com CNPJ e status.",
  },
  {
    href: "/faturamento/notas/nova",
    icone: "faturamento",
    titulo: "Nova nota fiscal",
    descricao: "Nota emitida, crédito e vínculo com a proposta.",
  },
];

/** Central de cadastro: só os caminhos, como o Painel de Controle. */
export default async function PaginaCadastrar() {
  await exigirSessao("editor");
  return (
    <div className="inicio">
      <CabecalhoPagina icone="mais" sobre={<Link href="/">Painel de Controle</Link>} titulo="Cadastrar" />
      <Link href={PRINCIPAL.href} className="inicio-destaque">
        <span className="inicio-destaque-icone">
          <Icone nome={PRINCIPAL.icone} tamanho={26} />
        </span>
        <span className="inicio-destaque-texto">
          <strong>{PRINCIPAL.titulo}</strong>
          <span>{PRINCIPAL.descricao}</span>
        </span>
        <Icone nome="seta" tamanho={22} className="inicio-destaque-seta" />
      </Link>
      <nav className="inicio-atalhos" aria-label="O que cadastrar">
        {OPCOES.map((o) => (
          <Link key={o.href} href={o.href} className="atalho-cartao">
            <Icone nome={o.icone} tamanho={22} className="atalho-cartao-icone" />
            <span className="atalho-cartao-titulo">{o.titulo}</span>
            <span className="atalho-cartao-detalhe">{o.descricao}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
