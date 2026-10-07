"use client";

import { useState } from "react";
import { formatarDataHora } from "@/lib/formato";

export type AnaliseSalva = { texto: string; gerado_em: string; gerado_por: string; modelo: string };

/**
 * Mostra a última análise salva (visível para todos) e, para o admin, o botão de gerar outra.
 * A análise é salva em configuracoes (chave ia_resultados), então não se paga uma chamada por visita.
 */
export function AnaliseResultadosIA({ inicial, podeGerar }: { inicial: AnaliseSalva | null; podeGerar: boolean }) {
  const [analise, setAnalise] = useState<AnaliseSalva | null>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/resultados/insights", { method: "POST" });
      const dados = (await resposta.json()) as { analise?: AnaliseSalva; erro?: string };
      if (!resposta.ok || !dados.analise) throw new Error(dados.erro ?? "Não foi possível gerar a análise.");
      setAnalise(dados.analise);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conectar com o serviço de IA.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      {analise ? (
        <div className="resultado-ia" aria-live="polite">
          {analise.texto
            .split(/\n+/)
            .filter(Boolean)
            .map((linha, i) => (
              <p key={i}>{linha}</p>
            ))}
          <p className="pequeno muted">
            Gerado por IA ({analise.modelo}) em {formatarDataHora(analise.gerado_em)} a pedido de {analise.gerado_por}. Texto
            automático: confira os números nas tabelas acima antes de usar.
          </p>
        </div>
      ) : (
        <p className="texto-2">Nenhuma análise gerada ainda.</p>
      )}
      {podeGerar ? (
        <div className="atalhos" style={{ marginTop: 12 }}>
          <button className="btn" type="button" onClick={gerar} disabled={carregando}>
            {carregando ? "Analisando…" : analise ? "Gerar nova análise" : "Gerar análise"}
          </button>
          <span className="pequeno muted">Só administradores · cada análise é uma chamada paga ao serviço de IA</span>
        </div>
      ) : null}
      {erro ? (
        <p className="aviso aviso-erro" role="alert" style={{ marginTop: 12 }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
