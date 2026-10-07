import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Jost } from "next/font/google";
import Script from "next/script";
import "./globals.css";

/** Títulos e números grandes: sans geométrica de letras redondas, ecoando o logo. */
const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

/** Textos e tabelas: sans neutra, muito legível, com algarismos tabulares. */
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cooesa Engenharia", template: "%s · Cooesa" },
  description: "Sistema interno de propostas, contratos e faturamento da Cooesa Engenharia.",
  robots: { index: false, follow: false },
  applicationName: "Cooesa",
  // Ícone da aba do navegador e da tela inicial (iPhone usa o apple-touch-icon).
  icons: {
    icon: [
      { url: "/icones/icone-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iPhone: nome sob o ícone e abrir em tela cheia, como um aplicativo.
  appleWebApp: { capable: true, title: "Cooesa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#27364c",
};

/** Aplica o tema salvo antes da primeira pintura, para não piscar. */
const scriptTema = `try{var t=localStorage.getItem('cooesa-tema');if(t==='claro')document.documentElement.dataset.theme='light';else if(t==='escuro')document.documentElement.dataset.theme='dark';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jost.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <Script id="cooesa-tema-inicial" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
