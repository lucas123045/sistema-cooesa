"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

/**
 * "Abertos recentemente": guarda no navegador (localStorage) os últimos registros abertos,
 * para retomar o trabalho no celular. Só Nº, cliente e escopo — nada de contato (LGPD).
 */

type Visita = { num: number; cliente: string; escopo: string | null; quando: number };

const CHAVE = "cooesa-recentes";
const MAXIMO = 6;
const ouvintes = new Set<() => void>();
let cache: { bruto: string | null; lista: Visita[] } = { bruto: null, lista: [] };

function ler(): Visita[] {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    return [];
  }
  if (bruto !== cache.bruto) {
    let lista: Visita[] = [];
    try {
      lista = bruto ? (JSON.parse(bruto) as Visita[]) : [];
    } catch {
      lista = [];
    }
    cache = { bruto, lista };
  }
  return cache.lista;
}

const vazio: Visita[] = [];

/** Coloque na página de detalhe do registro. */
export function MarcarVisita({ num, cliente, escopo }: { num: number; cliente: string; escopo: string | null }) {
  useEffect(() => {
    try {
      const lista = ler().filter((v) => v.num !== num);
      lista.unshift({ num, cliente, escopo: escopo ? escopo.slice(0, 120) : null, quando: Date.now() });
      localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAXIMO)));
      ouvintes.forEach((f) => f());
    } catch {
      // sem armazenamento local: só não lembra
    }
  }, [num, cliente, escopo]);
  return null;
}

export function AbertosRecentemente() {
  const lista = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    ler,
    () => vazio,
  );
  if (!lista.length) {
    return <p className="vazio pequeno">Os registros que você abrir aparecem aqui, para retomar depois.</p>;
  }
  return (
    <ul className="lista-painel">
      {lista.map((v) => (
        <li key={v.num}>
          <div>
            <Link href={`/registros/${v.num}`}>
              <strong>{v.cliente}</strong>
            </Link>
            <span className="sub">
              Nº {v.num}
              {v.escopo ? ` · ${v.escopo}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
