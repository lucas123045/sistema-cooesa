"use client";

import { useState } from "react";

/**
 * Gráficos em SVG próprio (sem biblioteca): barras agrupadas e linha.
 * - Um único eixo por gráfico (medidas de escalas diferentes vão em gráficos separados).
 * - Dica ao passar o mouse ou focar com o teclado em cada categoria.
 * - Legenda quando há 2+ séries; rótulo direto só no maior valor de cada série.
 * - Tabela com os dados sempre disponível (acessibilidade e contraste).
 */

type Formato = "inteiro" | "moeda" | "percentual";

export type Serie = {
  nome: string;
  classe: "serie-propostas" | "serie-contratos";
  valores: number[];
};

const L = 960;
const MARGEM = { topo: 18, direita: 8, base: 26, esquerda: 56 };

const fmtInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtMoedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fmtPct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatar(v: number | null, formato: Formato, compacto = false): string {
  if (v === null || Number.isNaN(v)) return "—";
  if (formato === "moeda") return compacto ? fmtMoedaCompacta.format(v) : fmtMoeda.format(v);
  if (formato === "percentual") return `${fmtPct.format(v)}%`;
  return fmtInteiro.format(v);
}

/** Topo "redondo" da escala e os valores das linhas de grade. */
function escala(maximo: number, teto?: number): number[] {
  if (maximo <= 0) return [0, 1];
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const topo = Math.min(teto ?? Infinity, Math.ceil(maximo / passo) * passo);
  const marcas: number[] = [];
  for (let v = 0; v <= topo + passo / 1000; v += passo) marcas.push(v);
  return marcas;
}

/** Barra com as pontas de dados arredondadas (4px) e a base reta no eixo. */
function caminhoBarra(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function Dica({ indice, total, children }: { indice: number; total: number; children: React.ReactNode }) {
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const centro = MARGEM.esquerda + (larguraUtil / total) * (indice + 0.5);
  const pos = indice < total * 0.2 ? "0" : indice > total * 0.8 ? "-100%" : "-50%";
  return (
    <div
      className="dica-grafico"
      role="status"
      style={{ left: `${(centro / L) * 100}%`, top: 0, transform: `translateX(${pos})` }}
    >
      {children}
    </div>
  );
}

function TabelaDados({ categorias, colunas }: { categorias: string[]; colunas: { nome: string; valores: string[] }[] }) {
  return (
    <details className="tabela-dados nao-imprimir">
      <summary>Ver dados em tabela</summary>
      <div className="tabela-rolagem" style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }}>
        <table className="tabela compacta">
          <thead>
            <tr>
              <th scope="col">Período</th>
              {colunas.map((c) => (
                <th scope="col" className="num" key={c.nome}>
                  {c.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat, i) => (
              <tr key={cat}>
                <td>{cat}</td>
                {colunas.map((c) => (
                  <td className="num" key={c.nome}>
                    {c.valores[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type PropsBarras = {
  titulo: string;
  categorias: string[];
  series: Serie[];
  formato: Formato;
  altura?: number;
  /** Mostra o rótulo do eixo X a cada N categorias (a última sempre aparece). */
  passoRotulo?: number;
  /** Linhas extras na dica, por categoria (ex.: taxa de sucesso). */
  extras?: string[][];
};

export function GraficoBarras({ titulo, categorias, series, formato, altura = 260, passoRotulo = 1, extras }: PropsBarras) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = categorias.length;
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = altura - MARGEM.topo - MARGEM.base;
  const maximo = Math.max(0, ...series.flatMap((s) => s.valores));
  const marcas = escala(maximo);
  const topo = marcas[marcas.length - 1];
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const faixa = larguraUtil / Math.max(n, 1);
  const larguraGrupo = Math.min(faixa * 0.74, 48 * series.length);
  const vao = series.length > 1 ? 2 : 0; // 2px de superfície entre barras vizinhas
  const larguraBarra = (larguraGrupo - vao * (series.length - 1)) / series.length;
  const indiceMaximo = series.map((s) => s.valores.indexOf(Math.max(...s.valores)));

  return (
    <figure className="grafico-caixa" style={{ margin: 0 }}>
      {series.length > 1 ? (
        <div className="legenda" style={{ marginBottom: 8 }}>
          {series.map((s) => (
            <span key={s.nome}>
              <i className={s.classe} aria-hidden="true" />
              {s.nome}
            </span>
          ))}
        </div>
      ) : null}
      <svg viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={titulo} onMouseLeave={() => setAtivo(null)}>
        {marcas.map((m) => (
          <g key={m}>
            <line className={m === 0 ? "eixo" : "grade-linha"} x1={MARGEM.esquerda} x2={L - MARGEM.direita} y1={y(m)} y2={y(m)} />
            <text x={MARGEM.esquerda - 8} y={y(m) + 4} textAnchor="end">
              {formatar(m, formato, true)}
            </text>
          </g>
        ))}
        {categorias.map((cat, i) => {
          const x0 = MARGEM.esquerda + faixa * i;
          const inicio = x0 + (faixa - larguraGrupo) / 2;
          const mostrarRotulo = i % passoRotulo === 0 || i === n - 1;
          return (
            <g key={cat}>
              <rect
                className={`alvo${ativo === i ? " ativo" : ""}`}
                x={x0}
                y={MARGEM.topo}
                width={faixa}
                height={alturaUtil}
                tabIndex={0}
                aria-label={`${cat}: ${series.map((s) => `${s.nome} ${formatar(s.valores[i], formato)}`).join(", ")}`}
                onMouseEnter={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
              />
              {series.map((s, j) => {
                const v = s.valores[i] ?? 0;
                const xb = inicio + j * (larguraBarra + vao);
                return (
                  <g key={s.nome} pointerEvents="none">
                    <path className={s.classe} d={caminhoBarra(xb, y(v), larguraBarra, y(0) - y(v))} />
                    {indiceMaximo[j] === i && v > 0 ? (
                      <text className="rotulo-valor" x={xb + larguraBarra / 2} y={y(v) - 5} textAnchor="middle">
                        {formatar(v, formato, true)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {mostrarRotulo ? (
                <text x={x0 + faixa / 2} y={altura - 8} textAnchor="middle">
                  {cat}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {ativo !== null ? (
        <Dica indice={ativo} total={n}>
          <strong>{categorias[ativo]}</strong>
          {series.map((s) => (
            <div key={s.nome}>
              {s.nome}: {formatar(s.valores[ativo], formato)}
            </div>
          ))}
          {extras?.[ativo]?.map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
        </Dica>
      ) : null}
      <TabelaDados
        categorias={categorias}
        colunas={[
          ...series.map((s) => ({ nome: s.nome, valores: s.valores.map((v) => formatar(v, formato)) })),
          ...(extras ? [{ nome: "Detalhe", valores: extras.map((e) => e.join(" · ")) }] : []),
        ]}
      />
    </figure>
  );
}

type PropsLinha = {
  titulo: string;
  categorias: string[];
  valores: (number | null)[];
  nome: string;
  formato: Formato;
  altura?: number;
  passoRotulo?: number;
  /** Teto da escala (ex.: 100 para percentuais). */
  teto?: number;
};

export function GraficoLinha({ titulo, categorias, valores, nome, formato, altura = 150, passoRotulo = 1, teto }: PropsLinha) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = categorias.length;
  const larguraUtil = L - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = altura - MARGEM.topo - MARGEM.base;
  const marcas = escala(Math.max(0, ...valores.map((v) => v ?? 0)), teto);
  const topo = marcas[marcas.length - 1];
  const y = (v: number) => MARGEM.topo + alturaUtil - (v / topo) * alturaUtil;
  const faixa = larguraUtil / Math.max(n, 1);
  const x = (i: number) => MARGEM.esquerda + faixa * (i + 0.5);

  // Anos sem propostas (valor nulo) interrompem a linha em vez de cair a zero.
  let d = "";
  valores.forEach((v, i) => {
    if (v === null) return;
    d += `${i > 0 && valores[i - 1] !== null ? "L" : "M"}${x(i)},${y(v)}`;
  });

  return (
    <figure className="grafico-caixa" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${altura}`} role="img" aria-label={titulo} onMouseLeave={() => setAtivo(null)}>
        {marcas.map((m) => (
          <g key={m}>
            <line className={m === 0 ? "eixo" : "grade-linha"} x1={MARGEM.esquerda} x2={L - MARGEM.direita} y1={y(m)} y2={y(m)} />
            <text x={MARGEM.esquerda - 8} y={y(m) + 4} textAnchor="end">
              {formatar(m, formato, true)}
            </text>
          </g>
        ))}
        {ativo !== null ? <line className="eixo" x1={x(ativo)} x2={x(ativo)} y1={MARGEM.topo} y2={y(0)} /> : null}
        <path className="linha-serie" d={d} />
        {valores.map((v, i) =>
          v !== null && (ativo === i || i === n - 1) ? (
            <circle key={i} className="ponto-serie" cx={x(i)} cy={y(v)} r={4.5} />
          ) : null,
        )}
        {categorias.map((cat, i) => (
          <g key={cat}>
            <rect
              className="alvo"
              style={{ opacity: 0 }}
              x={MARGEM.esquerda + faixa * i}
              y={MARGEM.topo}
              width={faixa}
              height={alturaUtil}
              tabIndex={0}
              aria-label={`${cat}: ${nome} ${formatar(valores[i], formato)}`}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
            {i % passoRotulo === 0 || i === n - 1 ? (
              <text x={x(i)} y={altura - 8} textAnchor="middle" pointerEvents="none">
                {cat}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {ativo !== null ? (
        <Dica indice={ativo} total={n}>
          <strong>{categorias[ativo]}</strong>
          <div>
            {nome}: {formatar(valores[ativo], formato)}
          </div>
        </Dica>
      ) : null}
    </figure>
  );
}
