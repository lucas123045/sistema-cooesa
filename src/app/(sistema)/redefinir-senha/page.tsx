"use client";

import { useActionState } from "react";
import { redefinirSenha, type EstadoForm } from "@/app/login/acoes";

export default function PaginaRedefinirSenha() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(redefinirSenha, {});
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <div className="sobre">Conta</div>
          <h1>Definir nova senha</h1>
          <p className="descricao">Use pelo menos 10 caracteres. Uma frase curta é mais fácil de lembrar e mais segura.</p>
        </div>
      </div>
      <div className="painel" style={{ maxWidth: 480 }}>
        <form action={acao} className="painel-corpo" noValidate>
          <div className="campo">
            <label htmlFor="senha">Nova senha</label>
            <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={10} />
          </div>
          <div className="campo" style={{ marginTop: 14 }}>
            <label htmlFor="confirmacao">Repita a nova senha</label>
            <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
          </div>
          {estado.erro ? (
            <p className="aviso aviso-erro" role="alert" style={{ marginTop: 14 }}>
              {estado.erro}
            </p>
          ) : null}
          <button className="btn btn-primario" type="submit" disabled={pendente} style={{ marginTop: 16 }}>
            {pendente ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </>
  );
}
