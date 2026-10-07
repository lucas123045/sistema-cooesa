import type { MetadataRoute } from "next";

/**
 * Manifesto do aplicativo (PWA): nome e ícone que aparecem quando alguém usa
 * "Adicionar à tela inicial" no celular. Ícones gerados do logo original
 * (public/brand/logo-cooesa-original.png) em public/icones/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cooesa",
    short_name: "Cooesa",
    description: "Propostas, contratos e faturamento da Cooesa Engenharia.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#27364c",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Com margem: o Android corta ícones "maskable" em círculo/arredondado sem perder as letras.
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
