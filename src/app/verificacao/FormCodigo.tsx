"use client";

import { useFormAcao } from "@/components/useFormAcao";
import { verificarCodigo, type EstadoForm } from "@/app/login/acoes";

export function FormCodigo() {
  const [estado, enviar, pendente] = useFormAcao<EstadoForm>(verificarCodigo, {});
  return (
    <form onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="codigo">Código</label>
        <input
          id="codigo"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="campo-codigo"
        />
      </div>
      {estado.erro ? (
        <p className="aviso aviso-erro" role="alert" style={{ marginTop: 14 }}>
          {estado.erro}
        </p>
      ) : null}
      <button className="btn btn-primario" type="submit" disabled={pendente}>
        {pendente ? "Conferindo…" : "Confirmar"}
      </button>
    </form>
  );
}
