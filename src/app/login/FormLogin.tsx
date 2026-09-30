"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrar, type EstadoForm } from "./acoes";

export function FormLogin() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(entrar, {});
  return (
    <form action={acao} noValidate>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      {estado.erro ? (
        <p className="aviso aviso-erro" role="alert" style={{ marginTop: 14 }}>
          {estado.erro}
        </p>
      ) : null}
      <button className="btn btn-primario" type="submit" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
      <p style={{ marginTop: 14, textAlign: "center" }}>
        <Link href="/recuperar-senha">Esqueci a senha</Link>
      </p>
    </form>
  );
}
