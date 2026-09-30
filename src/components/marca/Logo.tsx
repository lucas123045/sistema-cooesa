/**
 * Logotipo "Cooesa" recriado em vetor chapado (sem relevo e sem sombra).
 *
 * Geometria: letras de traço uniforme construídas sobre círculos, como no
 * logotipo original (desenho próximo da Century Gothic). A versão vetorial
 * precisa de aprovação do dono antes de ser usada fora do sistema (ver README).
 */

export const LOGO_VIEWBOX = "4 6 282 68";
export const LOGO_TRACO = 9;

/** Traços das letras C-o-o-e-s-a, em coordenadas do viewBox. */
export const LOGO_TRACOS = [
  // C — arco aberto à direita
  "M57.53 23.61 A25.5 25.5 0 1 0 57.53 56.39",
  // o
  "M101.5 48 A17.5 17.5 0 1 0 66.5 48 A17.5 17.5 0 1 0 101.5 48 Z",
  // o
  "M147.5 48 A17.5 17.5 0 1 0 112.5 48 A17.5 17.5 0 1 0 147.5 48 Z",
  // e — barra horizontal e arco que termina no quadrante inferior direito
  "M158.5 48 H193.5 A17.5 17.5 0 1 0 190.33 58.04",
  // s
  "M229 33 C226 30.5 221.5 30.5 217 30.5 C210 30.5 205 34 205 39 C205 45 212 46.5 217 48 C223 49.5 230 51 230 57.5 C230 62.5 224 65.5 217 65.5 C212 65.5 207 63.5 204 60",
  // a — bojo circular
  "M276 48 A17.5 17.5 0 1 0 241 48 A17.5 17.5 0 1 0 276 48 Z",
  // a — haste
  "M276 26 V70",
] as const;

type Props = {
  variante?: "azul" | "branco";
  titulo?: string;
  className?: string;
};

export function Logo({ variante = "azul", titulo = "Cooesa Engenharia", className }: Props) {
  const cor = variante === "branco" ? "#ffffff" : "#3e5b7b";
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label={titulo}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke={cor} strokeWidth={LOGO_TRACO} strokeLinecap="butt" strokeLinejoin="round">
        {LOGO_TRACOS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
