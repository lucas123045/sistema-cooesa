import { LOGO_TRACO, LOGO_TRACOS, LOGO_VIEWBOX } from "./Logo";

/**
 * Tela de carregamento: logo sobre o azul profundo, com o degradê azul-aço do
 * logo original preenchendo as letras de baixo para cima.
 * Só aparece depois de 250 ms (se os dados chegarem antes, nem é vista) e
 * respeita prefers-reduced-motion (ver .carregando em globals.css).
 */
export function TelaCarregamento() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="aco-degrade" x1="0" y1="10" x2="0" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#e4eef3" />
            <stop offset="0.45" stopColor="#8ab3c3" />
            <stop offset="1" stopColor="#68879d" />
          </linearGradient>
          <clipPath id="aco-carga">
            <rect className="enchimento" x="0" y="6" width="290" height="68" />
          </clipPath>
        </defs>
        <g fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={LOGO_TRACO}>
          {LOGO_TRACOS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="none" stroke="url(#aco-degrade)" strokeWidth={LOGO_TRACO} clipPath="url(#aco-carga)">
          {LOGO_TRACOS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}
