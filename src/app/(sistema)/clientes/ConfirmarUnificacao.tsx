import { unificarCliente } from "./acoes";

export function ConfirmarUnificacao({ origem, nomeOrigem, destino, nomeDestino }: { origem: number; nomeOrigem: string; destino: number; nomeDestino: string }) {
  return <section className="aviso aviso-alerta" style={{ marginBottom: 16 }}>
    <strong>Possível cliente duplicado</strong>
    <p>Confirme manualmente se “{nomeOrigem}” e “{nomeDestino}” são a mesma empresa. A unificação transfere propostas e notas para o destino e preserva o nome anterior no histórico.</p>
    <form action={unificarCliente} className="atalhos">
      <input type="hidden" name="origem" value={origem} />
      <input type="hidden" name="destino" value={destino} />
      <button className="btn btn-perigo" type="submit">Unificar em {nomeDestino}</button>
    </form>
  </section>;
}
