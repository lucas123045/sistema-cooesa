import { grupoDe } from "@/lib/situacoes";

/** Selo com a cor fixa do grupo da situação (contrato, aguardando, perdida, cancelada, litígio). */
export function SeloSituacao({ situacao }: { situacao: string | null | undefined }) {
  const grupo = grupoDe(situacao);
  if (!grupo) return <span className="selo selo-vazio">Sem situação</span>;
  return <span className={`selo selo-${grupo}`}>{situacao}</span>;
}
