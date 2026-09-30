"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/marca/Logo";
import { AlternarTema } from "@/components/AlternarTema";
import { ROTULO_PAPEL, type Papel } from "@/lib/papeis";
import { sair } from "@/app/login/acoes";

type Item = { href: string; rotulo: string; contador?: number; soAdmin?: boolean };

type Props = {
  nome: string;
  papel: Papel;
  pendencias: number | null;
};

function itens(pendencias: number | null): Item[] {
  return [
    { href: "/", rotulo: "Painel" },
    { href: "/registros", rotulo: "Propostas e contratos" },
    { href: "/curriculo", rotulo: "Currículo" },
    { href: "/faturamento", rotulo: "Faturamento" },
    { href: "/clientes", rotulo: "Clientes" },
    { href: "/pendencias", rotulo: "Pendências de dados", contador: pendencias ?? undefined },
    { href: "/configuracoes", rotulo: "Configurações", soAdmin: true },
  ];
}

function ativo(caminho: string, href: string) {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/");
}

function Menu({ caminho, lista, aoNavegar }: { caminho: string; lista: Item[]; aoNavegar?: () => void }) {
  return (
    <ul className="menu">
      {lista.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={ativo(caminho, item.href) ? "page" : undefined}
            onClick={aoNavegar}
          >
            <span>{item.rotulo}</span>
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

  return (
    <>
      <aside className="lateral" aria-label="Menu principal">
        <Link href="/" className="lateral-logo" aria-label="Cooesa — Painel">
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
          <Link href="/" aria-label="Cooesa — Painel">
            <Logo variante="branco" />
          </Link>
          <button
            type="button"
            className="menu-botao"
            aria-expanded={aberto}
            aria-controls="menu-movel"
            onClick={() => setAberto((v) => !v)}
          >
            {aberto ? "Fechar" : "Menu"}
          </button>
        </div>
        {aberto ? (
          <nav id="menu-movel">
            <Menu caminho={caminho} lista={lista} aoNavegar={() => setAberto(false)} />
            <Rodape nome={nome} papel={papel} />
          </nav>
        ) : null}
      </header>
    </>
  );
}
