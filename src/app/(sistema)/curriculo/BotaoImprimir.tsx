"use client";

/** Abre a impressão do navegador; "Salvar como PDF" gera o currículo com o cabeçalho da Cooesa. */
export function BotaoImprimir() {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      Imprimir / PDF
    </button>
  );
}

/** Envia o formulário de filtros assim que um nível muda, para os níveis seguintes se ajustarem. */
export function SelectEncadeado(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
