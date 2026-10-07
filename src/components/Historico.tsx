import { formatarDataHora, rotuloUsuario } from "@/lib/formato";
import { CAMPOS_OCULTOS_HISTORICO, ROTULO_CAMPO } from "@/lib/rotulos";
import type { LinhaHistorico } from "@/lib/tipos";

const ROTULO_ACAO = { insert: "Criado", update: "Alterado", delete: "Excluído" } as const;

function mostrar(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function diferencas(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null) {
  const chaves = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const lista: { campo: string; de: unknown; para: unknown }[] = [];
  for (const k of chaves) {
    if (CAMPOS_OCULTOS_HISTORICO.has(k)) continue;
    const a = antes?.[k] ?? null;
    const d = depois?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(d)) lista.push({ campo: k, de: a, para: d });
  }
  return lista;
}

/**
 * Lista do histórico de alterações. `ocultarCampos` permite esconder dados
 * pessoais (ex.: contato) quando o histórico é exibido fora do registro.
 */
export function Historico({ linhas, ocultarCampos = [] }: { linhas: LinhaHistorico[]; ocultarCampos?: string[] }) {
  if (!linhas.length) return <p className="vazio">Nenhuma alteração registrada.</p>;
  return (
    <ul className="linha-tempo">
      {linhas.map((h) => {
        const difs = h.acao === "update" ? diferencas(h.antes, h.depois).filter((d) => !ocultarCampos.includes(d.campo)) : [];
        return (
          <li key={h.id}>
            <div className="pequeno muted tabular">{formatarDataHora(h.quando)}</div>
            <div>
              <strong>{ROTULO_ACAO[h.acao]}</strong> <span className="muted">por {rotuloUsuario(h.usuario)}</span>
              {difs.length ? (
                <ul className="diff">
                  {difs.map((d) => (
                    <li key={d.campo}>
                      <span className="texto-2">{ROTULO_CAMPO[d.campo] ?? d.campo}:</span> <del>{mostrar(d.de)}</del> →{" "}
                      <ins>{mostrar(d.para)}</ins>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
