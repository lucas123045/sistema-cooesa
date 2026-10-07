import { CLASSE_STATUS, eStatusEmpresa } from "@/lib/empresas";

/** Selo do status de relacionamento da empresa. Sem status: mostra a sugestão, em tom apagado. */
export function SeloStatusEmpresa({ status, sugerido }: { status: string | null | undefined; sugerido?: string | null }) {
  if (eStatusEmpresa(status)) return <span className={`selo ${CLASSE_STATUS[status]}`}>{status}</span>;
  return (
    <span className="selo selo-vazio" title={sugerido ? `Sugestão do sistema: ${sugerido}` : undefined}>
      {sugerido ? `Sem status · sugerido: ${sugerido}` : "Sem status"}
    </span>
  );
}
