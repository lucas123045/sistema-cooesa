"use client";

import { useState, useTransition } from "react";
import { SeloStatusEmpresa } from "@/components/SeloStatusEmpresa";
import { useFormAcao } from "@/components/useFormAcao";
import { STATUS_EMPRESA } from "@/lib/empresas";
import type { ContatoEmpresa } from "@/lib/tipos";
import { alterarStatus, removerContato, salvarContato, type EstadoContato } from "../acoes";

/** Status da empresa, salvo na hora ao escolher (sem abrir o formulário). */
export function SeletorStatus({
  id,
  status,
  sugerido,
  podeEditar,
}: {
  id: number;
  status: string | null;
  sugerido: string | null;
  podeEditar: boolean;
}) {
  const [atual, setAtual] = useState(status ?? "");
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  if (!podeEditar) return <SeloStatusEmpresa status={status} sugerido={sugerido} />;

  return (
    <div className="seletor-status">
      <label htmlFor="status-empresa" className="rotulo">
        Status
      </label>
      <select
        id="status-empresa"
        value={atual}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value;
          const anterior = atual;
          setAtual(novo);
          setMensagem(null);
          iniciar(async () => {
            const r = await alterarStatus(id, novo);
            if (r.erro) {
              setAtual(anterior);
              setMensagem({ tipo: "erro", texto: r.erro });
            } else setMensagem({ tipo: "ok", texto: "Salvo" });
          });
        }}
      >
        {!atual ? <option value="">Sem status{sugerido ? ` (sugerido: ${sugerido})` : ""}</option> : null}
        {STATUS_EMPRESA.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <span className={mensagem?.tipo === "erro" ? "erro-campo" : "pequeno muted"} role="status">
        {pendente ? "Salvando…" : (mensagem?.texto ?? "")}
      </span>
    </div>
  );
}

function FormContato({
  clienteId,
  contato,
  aoTerminar,
}: {
  clienteId: number;
  contato?: ContatoEmpresa;
  aoTerminar: () => void;
}) {
  const [estado, enviar, pendente] = useFormAcao<EstadoContato>(async (anterior, dados) => {
    const r = await salvarContato(anterior, dados);
    if (!r.erro) aoTerminar();
    return r;
  }, {});
  const erro = (c: string) => estado.campos?.[c];
  const id = contato?.id ?? "novo";
  return (
    <form onSubmit={enviar} className="formulario form-contato" noValidate>
      <input type="hidden" name="cliente_id" value={clienteId} />
      {contato ? <input type="hidden" name="id" value={contato.id} /> : null}
      {estado.erro ? <p className="aviso aviso-erro c-12">{estado.erro}</p> : null}
      <div className="campo c-6">
        <label htmlFor={`c-nome-${id}`}>Nome</label>
        <input
          id={`c-nome-${id}`}
          name="nome"
          type="text"
          defaultValue={contato?.nome ?? ""}
          aria-invalid={erro("nome") ? true : undefined}
          autoFocus
        />
        {erro("nome") ? <span className="erro-campo">{erro("nome")}</span> : null}
      </div>
      <div className="campo c-6">
        <label htmlFor={`c-cargo-${id}`}>Cargo</label>
        <input id={`c-cargo-${id}`} name="cargo" type="text" defaultValue={contato?.cargo ?? ""} />
      </div>
      <div className="campo c-6">
        <label htmlFor={`c-email-${id}`}>E-mail</label>
        <input
          id={`c-email-${id}`}
          name="email"
          type="email"
          inputMode="email"
          defaultValue={contato?.email ?? ""}
          aria-invalid={erro("email") ? true : undefined}
        />
        {erro("email") ? <span className="erro-campo">{erro("email")}</span> : null}
      </div>
      <div className="campo c-6">
        <label htmlFor={`c-tel-${id}`}>Telefone</label>
        <input id={`c-tel-${id}`} name="telefone" type="tel" inputMode="tel" defaultValue={contato?.telefone ?? ""} />
      </div>
      <div className="campo c-12">
        <label htmlFor={`c-obs-${id}`}>Observações</label>
        <input id={`c-obs-${id}`} name="observacoes" type="text" defaultValue={contato?.observacoes ?? ""} />
      </div>
      <label className="checagem c-12">
        <input type="checkbox" name="principal" value="1" defaultChecked={contato?.principal ?? false} /> Contato principal
      </label>
      <div className="c-12 atalhos">
        <button className="btn btn-primario btn-pequeno" type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar contato"}
        </button>
        <button className="btn btn-texto btn-pequeno" type="button" onClick={aoTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Contatos da empresa: adicionar, editar e remover na própria tela. Dados pessoais (LGPD). */
export function Contatos({
  clienteId,
  contatos,
  podeEditar,
}: {
  clienteId: number;
  contatos: ContatoEmpresa[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<number | "novo" | null>(null);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div>
      {erro ? (
        <p className="aviso aviso-erro" style={{ margin: 12 }}>
          {erro}
        </p>
      ) : null}
      {contatos.length === 0 && editando !== "novo" ? <p className="vazio pequeno">Nenhum contato cadastrado.</p> : null}
      <ul className="lista-contatos">
        {contatos.map((c) =>
          editando === c.id ? (
            <li key={c.id}>
              <FormContato clienteId={clienteId} contato={c} aoTerminar={() => setEditando(null)} />
            </li>
          ) : (
            <li key={c.id}>
              <div className="contato-dados">
                <strong>
                  {c.nome}
                  {c.principal ? <span className="selo selo-neutro">principal</span> : null}
                </strong>
                {c.cargo ? <span className="sub">{c.cargo}</span> : null}
                <span className="contato-meios">
                  {c.telefone ? <a href={`tel:${c.telefone.replace(/[^\d+]/g, "")}`}>{c.telefone}</a> : null}
                  {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}
                </span>
                {c.observacoes ? <span className="sub">{c.observacoes}</span> : null}
              </div>
              {podeEditar ? (
                <div className="atalhos">
                  <button className="btn btn-pequeno" type="button" onClick={() => setEditando(c.id)}>
                    Editar
                  </button>
                  <button
                    className="btn btn-pequeno btn-texto"
                    type="button"
                    disabled={pendente}
                    onClick={() => {
                      if (!window.confirm(`Remover o contato ${c.nome}? A remoção fica no histórico.`)) return;
                      setErro(null);
                      iniciar(async () => {
                        const r = await removerContato(c.id, clienteId);
                        if (r.erro) setErro(r.erro);
                      });
                    }}
                  >
                    Remover
                  </button>
                </div>
              ) : null}
            </li>
          ),
        )}
        {editando === "novo" ? (
          <li>
            <FormContato clienteId={clienteId} aoTerminar={() => setEditando(null)} />
          </li>
        ) : null}
      </ul>
      {podeEditar && editando === null ? (
        <div className="painel-corpo" style={{ borderTop: "1px solid var(--borda)" }}>
          <button className="btn btn-pequeno" type="button" onClick={() => setEditando("novo")}>
            + Adicionar contato
          </button>
        </div>
      ) : null}
    </div>
  );
}
