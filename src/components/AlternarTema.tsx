"use client";

import { useSyncExternalStore } from "react";

type Tema = "sistema" | "claro" | "escuro";
const CHAVE = "cooesa-tema";
const ROTULO: Record<Tema, string> = { sistema: "Tema: sistema", claro: "Tema: claro", escuro: "Tema: escuro" };
const PROXIMO: Record<Tema, Tema> = { sistema: "claro", claro: "escuro", escuro: "sistema" };

const ouvintes = new Set<() => void>();

function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

function aplicar(tema: Tema) {
  const html = document.documentElement;
  if (tema === "claro") html.dataset.theme = "light";
  else if (tema === "escuro") html.dataset.theme = "dark";
  else delete html.dataset.theme;
  try {
    if (tema === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    // sem armazenamento local: o tema vale só nesta página
  }
  ouvintes.forEach((f) => f());
}

export function AlternarTema() {
  const tema = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    lerTema,
    () => "sistema" as Tema,
  );
  return (
    <button type="button" onClick={() => aplicar(PROXIMO[tema])} title="Alternar entre sistema, claro e escuro">
      {ROTULO[tema]}
    </button>
  );
}
