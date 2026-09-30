import Link from "next/link";
import { formatarMoeda } from "@/lib/formato";
import type { LinhaCliente } from "@/lib/tipos";
import { unificarCliente } from "./acoes";

type Props = {
  /** Cliente que deixa de existir. */
  origem: LinhaCliente;
  /** Cliente cujo nome fica. */
  destino: LinhaCliente;
  trocarHref: string;
  cancelarHref: string;
};

/** Prévia da unificação: mostra o que vai mudar e exige confirmação explícita. */
export function ConfirmarUnificacao({ origem, destino, trocarHref, cancelarHref }: Props) {
  return (
    <section className="aviso aviso-alerta">
      <h2 style={{ marginBottom: 8 }}>Prévia da unificação</h2>
      <p>
        Fica o nome <strong>“{destino.nome}”</strong>. O cadastro <strong>“{origem.nome}”</strong> deixa de existir e passa para ele:
      </p>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
        <li>
          <strong>{origem.propostas}</strong> proposta(s), das quais {origem.contratos} contrato(s);
        </li>
        <li>
          <strong>{origem.notas}</strong> nota(s) fiscal(is), somando {formatarMoeda(Number(origem.faturado))}.
        </li>
      </ul>
      <p className="pequeno">
        Depois: “{destino.nome}” terá {destino.propostas + origem.propostas} propostas. A grafia “{origem.nome}” fica guardada nos
        registros afetados e no histórico. Esta ação não tem desfazer automático.
      </p>
      <form action={unificarCliente} className="atalhos">
        <input type="hidden" name="origem" value={origem.id} />
        <input type="hidden" name="destino" value={destino.id} />
        <label className="checagem">
          <input type="checkbox" name="confirmo" value="1" required /> Confirmo que é a mesma empresa
        </label>
        <button className="btn btn-perigo" type="submit">
          Unificar em “{destino.nome}”
        </button>
        <Link className="btn" href={trocarHref}>
          Manter o outro nome
        </Link>
        <Link className="btn btn-texto" href={cancelarHref}>
          Cancelar
        </Link>
      </form>
    </section>
  );
}
