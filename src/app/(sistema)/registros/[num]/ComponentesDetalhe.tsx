"use client";

import { useRef, useState, useTransition } from "react";
import { alterarStatus } from "@/app/(sistema)/clientes/acoes";
import { useFormAcao } from "@/components/useFormAcao";
import { adicionarAcompanhamento, excluirRegistro, type EstadoRegistro } from "../acoes";

export function FormAcompanhamento({ num }: { num: number }) {
  const form = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendente] = useFormAcao<EstadoRegistro>(async (anterior, dados) => {
    const r = await adicionarAcompanhamento(anterior, dados);
    if (!r.erro) form.current?.reset(); // limpa só quando deu certo
    return r;
  }, {});
  return (
    <form ref={form} onSubmit={enviar} className="painel-corpo formulario" style={{ borderTop: "1px solid var(--borda)" }}>
      <input type="hidden" name="registro_num" value={num} />
      <div className="campo c-8">
        <label htmlFor="acomp-obs">Nova anotação</label>
        <textarea
          id="acomp-obs"
          name="obs"
          rows={2}
          placeholder="Ex.: cliente pediu revisão do cronograma; retorno previsto para a próxima semana."
        />
      </div>
      <div className="campo c-4">
        <label htmlFor="acomp-receber">A receber (opcional)</label>
        <input id="acomp-receber" name="a_receber" type="text" inputMode="decimal" placeholder="0,00" />
      </div>
      <div className="c-12 atalhos">
        <button className="btn btn-primario" type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Adicionar anotação"}
        </button>
        {estado.erro ? (
          <span className="erro-campo" role="alert" style={{ color: "var(--erro)" }}>
            {estado.erro}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function BotaoExcluirRegistro({ num }: { num: number }) {
  return (
    <form
      action={excluirRegistro}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Excluir o registro Nº ${num}? A exclusão fica registrada no histórico, mas o registro sai de todas as listas. ` +
            "Prefira mudar a situação (ex.: Proposta cancelada).",
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="num" value={num} />
      <button className="btn btn-perigo" type="submit">
        Excluir
      </button>
    </form>
  );
}

/** Proposta nova para empresa em Prospecção: sugere (sem forçar) mudar o status. */
export function SugerirStatusEmpresa({ clienteId, nome }: { clienteId: number; nome: string }) {
  const [feito, setFeito] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (feito) return <p className="aviso aviso-sucesso">{feito}</p>;
  return (
    <div className="aviso atalhos">
      <span>
        <strong>{nome}</strong> está em Prospecção. Com esta proposta, mudar o status para <strong>Proposta em andamento</strong>?
      </span>
      <button
        className="btn btn-pequeno"
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await alterarStatus(clienteId, "Proposta em andamento");
            setFeito(r.erro ?? `Status de ${nome} atualizado para Proposta em andamento.`);
          })
        }
      >
        Mudar status
      </button>
    </div>
  );
}
