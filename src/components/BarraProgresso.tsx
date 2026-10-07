"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Barra fina no topo enquanto a próxima página carrega (substitui a tela de carregamento).
 * Começa ao clicar num link interno ou enviar um formulário de busca (GET) e some quando
 * a URL muda. Se a navegação não acontecer, some sozinha depois de 10 s.
 */
export function BarraProgresso() {
  const caminho = usePathname();
  const parametros = useSearchParams();
  const rota = `${caminho}?${parametros.toString()}`;
  const rotaAtual = useRef(rota);
  const [iniciadaEm, setIniciadaEm] = useState<string | null>(null);

  useEffect(() => {
    rotaAtual.current = rota;
  }, [rota]);

  useEffect(() => {
    let limite: ReturnType<typeof setTimeout> | undefined;
    const iniciar = () => {
      setIniciadaEm(rotaAtual.current);
      clearTimeout(limite);
      limite = setTimeout(() => setIniciadaEm(null), 10_000);
    };
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname.match(/\/(exportar|backup)/)) return; // downloads não trocam de página
      if (`${url.pathname}?${url.searchParams.toString()}` === rotaAtual.current) return;
      iniciar();
    };
    const envio = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if ((form.getAttribute("method") ?? "get").toLowerCase() === "get" && form.getAttribute("action")) iniciar();
    };
    document.addEventListener("click", clique, true);
    document.addEventListener("submit", envio, true);
    return () => {
      document.removeEventListener("click", clique, true);
      document.removeEventListener("submit", envio, true);
      clearTimeout(limite);
    };
  }, []);

  // Some sozinha quando a URL muda (a rota atual deixa de ser a do início).
  const visivel = iniciadaEm !== null && iniciadaEm === rota;
  return visivel ? <div className="barra-progresso" role="progressbar" aria-label="Carregando página" /> : null;
}
