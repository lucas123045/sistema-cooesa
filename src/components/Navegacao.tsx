"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { AlternarTema } from "@/components/AlternarTema";
import { Icone, type NomeIcone } from "@/components/Icone";
import { ROTULO_PAPEL, type Papel } from "@/lib/papeis";
import { sair } from "@/app/login/acoes";

type Item = { href: string; rotulo: string; icone: NomeIcone; contador?: number; soAdmin?: boolean; grupo?: "analise" };

type Props = {
  nome: string;
  papel: Papel;
  pendencias: number | null;
};

function itens(pendencias: number | null): Item[] {
  return [
    { href: "/", rotulo: "Painel de Controle", icone: "inicio" },
    { href: "/registros", rotulo: "Propostas e contratos", icone: "propostas" },
    { href: "/clientes", rotulo: "Clientes", icone: "clientes" },
    { href: "/faturamento", rotulo: "Faturamento", icone: "faturamento" },
    { href: "/curriculo", rotulo: "Currículo", icone: "curriculo" },
    { href: "/painel", rotulo: "Visão geral", icone: "painel", grupo: "analise" },
    { href: "/resultados", rotulo: "Resultados", icone: "resultados", grupo: "analise" },
    {
      href: "/pendencias",
      rotulo: "Pendências de dados",
      icone: "pendencias",
      contador: pendencias ?? undefined,
      grupo: "analise",
    },
    { href: "/configuracoes", rotulo: "Configurações", icone: "configuracoes", soAdmin: true, grupo: "analise" },
  ];
}

/** Barra inferior do celular: o que se usa com o polegar. */
const ABAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/", rotulo: "Início", icone: "inicio" },
  { href: "/registros", rotulo: "Propostas", icone: "propostas" },
  { href: "/clientes", rotulo: "Clientes", icone: "clientes" },
  { href: "/faturamento", rotulo: "Faturamento", icone: "faturamento" },
];

function ativo(caminho: string, href: string) {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/");
}

function Menu({ caminho, lista, aoNavegar }: { caminho: string; lista: Item[]; aoNavegar?: () => void }) {
  return (
    <ul className="menu">
      {lista.map((item, i) => (
        <li key={item.href} className={item.grupo && lista[i - 1] && !lista[i - 1].grupo ? "menu-separador" : undefined}>
          <Link href={item.href} aria-current={ativo(caminho, item.href) ? "page" : undefined} onClick={aoNavegar}>
            <span className="menu-rotulo">
              <Icone nome={item.icone} tamanho={18} />
              {item.rotulo}
            </span>
            {item.contador ? (
              <span className="menu-contador" aria-label={`${item.contador} pendências`}>
                {item.contador}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Rodape({ nome, papel }: { nome: string; papel: Papel }) {
  return (
    <div className="lateral-rodape">
      <div className="lateral-usuario" title={nome}>
        {nome}
      </div>
      <div className="lateral-papel">{ROTULO_PAPEL[papel]}</div>
      <div className="lateral-acoes">
        <Link href="/conta">Minha conta</Link>
        <AlternarTema />
        <form action={sair}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </div>
  );
}

export function Navegacao({ nome, papel, pendencias }: Props) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const lista = itens(pendencias).filter((i) => !i.soAdmin || papel === "admin");
  const primeiroNome = nome.split(" ")[0];

  const gaveta = useRef<HTMLDivElement>(null);

  // Menu do celular como diálogo acessível: foco vai para dentro, Tab circula só nele,
  // Esc fecha, o fundo não rola e, ao fechar, o foco volta para quem abriu.
  useEffect(() => {
    if (!aberto) return;
    const quemAbriu = document.activeElement as HTMLElement | null;
    const focaveis = () => Array.from(gaveta.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focaveis()[0]?.focus();
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        return;
      }
      if (e.key !== "Tab") return;
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", teclado);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", teclado);
      document.body.style.overflow = "";
      quemAbriu?.focus();
    };
  }, [aberto]);

  return (
    <>
      <aside className="lateral" aria-label="Menu principal">
        <Link href="/" className="lateral-logo" aria-label="Cooesa — Painel de Controle">
          <Logo variante="branco" />
          <span className="lateral-sub">Engenharia · Acervo</span>
        </Link>
        <nav>
          <Menu caminho={caminho} lista={lista} />
        </nav>
        <Rodape nome={nome} papel={papel} />
      </aside>

      <header className="topo-movel">
        <div className="topo-movel-barra">
          <button
            type="button"
            className="menu-botao"
            aria-expanded={aberto}
            aria-controls="menu-movel"
            aria-label="Abrir menu"
            onClick={() => setAberto(true)}
          >
            <Icone nome="menu" tamanho={22} />
          </button>
          <Link href="/" aria-label="Cooesa — Painel de Controle" className="topo-movel-logo">
            <Logo variante="branco" />
          </Link>
          <span className="topo-movel-ola">
            Olá, <strong>{primeiroNome}</strong>
          </span>
        </div>
      </header>

      {aberto ? (
        <div className="gaveta-fundo" onClick={() => setAberto(false)}>
          <div
            id="menu-movel"
            ref={gaveta}
            className="gaveta"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gaveta-topo">
              <Logo variante="branco" />
              <button type="button" className="menu-botao" aria-label="Fechar menu" onClick={() => setAberto(false)}>
                <Icone nome="fechar" tamanho={22} />
              </button>
            </div>
            <nav>
              <Menu caminho={caminho} lista={lista} aoNavegar={() => setAberto(false)} />
            </nav>
            <Rodape nome={nome} papel={papel} />
          </div>
        </div>
      ) : null}

      <nav className="abas-movel" aria-label="Atalhos">
        {ABAS.map((a) => (
          <Link key={a.href} href={a.href} aria-current={ativo(caminho, a.href) ? "page" : undefined}>
            <Icone nome={a.icone} tamanho={22} />
            <span>{a.rotulo}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setAberto(true)} aria-label="Mais opções" aria-expanded={aberto}>
          <Icone nome="menu" tamanho={22} />
          <span>
            Mais
            {pendencias ? <i className="abas-ponto" aria-label={`${pendencias} pendências`} /> : null}
          </span>
        </button>
      </nav>
    </>
  );
}
