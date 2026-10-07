import Link from "next/link";
import { formatarInteiro, formatarMoeda, formatarMoedaCompacta, formatarPercentual } from "@/lib/formato";
import type { Agregado } from "@/lib/resultados";

/** Indicador com valor compacto (R$ 18,3 mi) e o valor exato na dica. */
export function Indicador(props: {
  rotulo: string;
  valor: string;
  exato?: string;
  detalhe?: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className={`indicador${props.destaque ? " destaque" : ""}`}>
      <div className="indicador-rotulo">{props.rotulo}</div>
      <div className="indicador-valor menor" title={props.exato}>
        {props.valor}
      </div>
      {props.detalhe ? <div className="indicador-detalhe">{props.detalhe}</div> : null}
    </div>
  );
}

/** ▲ / ▼ neutros (subir não é necessariamente bom): quem lê decide. */
export function Variacao({ valor, pontos = false }: { valor: number | null; pontos?: boolean }) {
  if (valor === null || Number.isNaN(valor)) return <span className="variacao">—</span>;
  const seta = valor > 0.05 ? "▲" : valor < -0.05 ? "▼" : "=";
  const texto = pontos
    ? `${valor > 0 ? "+" : ""}${valor.toFixed(1).replace(".", ",")} p.p.`
    : `${valor > 0 ? "+" : ""}${formatarPercentual(valor)}`;
  return (
    <span className="variacao">
      {seta} {texto}
    </span>
  );
}

export function moeda(v: number | null) {
  return { valor: formatarMoedaCompacta(v), exato: formatarMoeda(v) };
}

/** Barra fina de 0–100% dentro de uma célula. */
export function MiniBarra({ pct, classe = "serie-contratos" }: { pct: number | null; classe?: string }) {
  return (
    <span className="mini-barra" aria-hidden="true">
      <span className={classe} style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
    </span>
  );
}

type LinhaDesempenho = { chave: string | number; dados: Agregado; href?: string };

/** Tabela de desempenho (área, setor, gerente): quantidade, taxa e valores de P. */
export function TabelaDesempenho({
  titulo,
  linhas,
  rotuloChave,
}: {
  titulo: string;
  linhas: LinhaDesempenho[];
  rotuloChave: string;
}) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela tabela-cartoes compacta" aria-label={titulo}>
        <thead>
          <tr>
            <th>{rotuloChave}</th>
            <th className="num">Propostas</th>
            <th className="num">Contratos</th>
            <th>Sucesso (qtd.)</th>
            <th className="num">Sucesso (valor P)</th>
            <th className="num">Contratado (P)</th>
            <th className="num">Ticket contratado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={String(l.chave)}>
              <td className="c-principal">{l.href ? <Link href={l.href}>{l.chave}</Link> : l.chave}</td>
              <td data-label="Propostas" className="num">
                {formatarInteiro(l.dados.propostas)}
              </td>
              <td data-label="Contratos" className="num">
                {formatarInteiro(l.dados.contratos)}
              </td>
              <td data-label="Sucesso (qtd.)" className="celula-taxa">
                <MiniBarra pct={l.dados.taxaQuantidade} />
                <span className="tabular">{formatarPercentual(l.dados.taxaQuantidade)}</span>
              </td>
              <td data-label="Sucesso (valor P)" className="num">
                {formatarPercentual(l.dados.taxaValor)}
              </td>
              <td data-label="Contratado (P)" className="num">
                {l.dados.contratadoP ? formatarMoeda(l.dados.contratadoP) : "—"}
              </td>
              <td data-label="Ticket contratado" className="num">
                {l.dados.ticketContratadoP === null ? "—" : formatarMoeda(l.dados.ticketContratadoP)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
