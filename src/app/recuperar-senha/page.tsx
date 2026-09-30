"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { recuperarSenha, type EstadoForm } from "@/app/login/acoes";

export default function PaginaRecuperarSenha() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(recuperarSenha, {});
  return (
    <LayoutAcesso>
      <h1>Recuperar senha</h1>
      <p className="texto-2">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
      {estado.ok ? (
        <p className="aviso aviso-sucesso" role="status">
          {estado.ok}
        </p>
      ) : (
        <form action={acao} noValidate>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          {estado.erro ? (
            <p className="aviso aviso-erro" role="alert" style={{ marginTop: 14 }}>
              {estado.erro}
            </p>
          ) : null}
          <button className="btn btn-primario" type="submit" disabled={pendente}>
            {pendente ? "Enviando…" : "Enviar link"}
          </button>
        </form>
      )}
      <p style={{ marginTop: 14, textAlign: "center" }}>
        <Link href="/login">Voltar para o login</Link>
      </p>
    </LayoutAcesso>
  );
}
