import type { Metadata } from "next";
import Link from "next/link";
import { Icone, type NomeIcone } from "@/components/Icone";
import { eAdmin, podeEditar } from "@/lib/papeis";
import { exigirSessao } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel de Controle" };

type Area = { href: string; icone: NomeIcone; titulo: string; descricao: string };

/** Cadastro rápido (editor e admin), ao lado do destaque principal. */
const CADASTRAR: Area = {
  href: "/cadastrar",
  icone: "mais",
  titulo: "Cadastrar",
  descricao: "Nova proposta, empresa, nota fiscal ou atualização de situação.",
};

/** Área principal, em destaque. */
const DESTAQUE: Area = {
  href: "/registros",
  icone: "propostas",
  titulo: "Propostas e contratos",
  descricao: "Todo o acervo comercial desde 2000: busca, filtros, cadastro e histórico de cada proposta.",
};

const AREAS: Area[] = [
  {
    href: "/clientes",
    icone: "clientes",
    titulo: "Empresas",
    descricao: "Cadastro, status, contatos, propostas e valores de cada empresa.",
  },
  {
    href: "/faturamento",
    icone: "faturamento",
    titulo: "Faturamento",
    descricao: "Notas fiscais, créditos e tributos estimados.",
  },
  {
    href: "/curriculo",
    icone: "curriculo",
    titulo: "Currículo",
    descricao: "Contratos que comprovam experiência para licitações.",
  },
  { href: "/painel", icone: "painel", titulo: "Visão geral", descricao: "Linha do tempo da empresa e principais indicadores." },
  { href: "/resultados", icone: "resultados", titulo: "Resultados", descricao: "Desempenho por área, gerente e cliente." },
  {
    href: "/pendencias",
    icone: "pendencias",
    titulo: "Pendências de dados",
    descricao: "Revisão das inconsistências herdadas da planilha.",
  },
];

/** Tela inicial: só os caminhos para as áreas do sistema. */
export default async function PainelDeControle() {
  const sessao = await exigirSessao();

  return (
    <div className="inicio">
      <header className="inicio-faixa">
        <h1>Painel de Controle</h1>
        <p>Gestão de propostas, contratos e faturamento da Cooesa Engenharia</p>
      </header>

      <div className="inicio-destaques">
        {(podeEditar(sessao.papel) ? [CADASTRAR, DESTAQUE] : [DESTAQUE]).map((d) => (
          <Link key={d.href} href={d.href} className="inicio-destaque">
            <span className="inicio-destaque-icone">
              <Icone nome={d.icone} tamanho={26} />
            </span>
            <span className="inicio-destaque-texto">
              <strong>{d.titulo}</strong>
              <span>{d.descricao}</span>
            </span>
            <Icone nome="seta" tamanho={22} className="inicio-destaque-seta" />
          </Link>
        ))}
      </div>

      <nav className="inicio-atalhos" aria-label="Áreas do sistema">
        {AREAS.map((a) => (
          <Link key={a.href} href={a.href} className="atalho-cartao">
            <Icone nome={a.icone} tamanho={22} className="atalho-cartao-icone" />
            <span className="atalho-cartao-titulo">{a.titulo}</span>
            <span className="atalho-cartao-detalhe">{a.descricao}</span>
          </Link>
        ))}
      </nav>

      {/* Fora da grade (só admin): evita um cartão sozinho na última linha. */}
      {eAdmin(sessao.papel) ? (
        <Link href="/configuracoes" className="inicio-rodape">
          <Icone nome="configuracoes" tamanho={18} /> Configurações · usuários, alíquotas e backup
        </Link>
      ) : null}
    </div>
  );
}
