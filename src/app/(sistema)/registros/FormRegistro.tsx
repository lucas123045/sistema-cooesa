"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormAcao } from "@/components/useFormAcao";
import { formatarData } from "@/lib/formato";
import { ROTULO_TIPO_PENDENCIA } from "@/lib/rotulos";
import { SITUACOES } from "@/lib/situacoes";
import type { Pendencia, Registro } from "@/lib/tipos";
import type { Sugestoes } from "@/lib/registros/sugestoes";
import { valorParaCampo } from "@/lib/valores";
import { salvarRegistro, type EstadoRegistro } from "./acoes";

type Props = {
  registro?: Registro & { cliente_nome: string };
  clientes: string[];
  sugestoes: Sugestoes;
  pendencias?: Pendencia[];
};

const REVISAVEIS = ["data_encerramento", "valor_texto", "cliente_unificado"];

export function FormRegistro({ registro, clientes, sugestoes, pendencias = [] }: Props) {
  const [estado, enviar, pendente] = useFormAcao<EstadoRegistro>(salvarRegistro, {});
  const [cliente, setCliente] = useState(registro?.cliente_nome ?? "");
  const [tipo, setTipo] = useState<string>(registro?.tipo ?? "P");
  const erro = (c: string) => estado.campos?.[c];
  const clienteNovo =
    cliente.trim() !== "" && !clientes.includes(cliente.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR"));
  const revisaveis = pendencias.filter((p) => REVISAVEIS.includes(p.tipo));

  const campoTexto = (nome: keyof Registro | "cliente", rotulo: string, props: { classe?: string; lista?: string; ajuda?: string; valor?: string | null } = {}) => (
    <div className={`campo ${props.classe ?? "c-6"}`}>
      <label htmlFor={`f-${nome}`}>{rotulo}</label>
      <input
        id={`f-${nome}`}
        name={nome}
        type="text"
        list={props.lista}
        defaultValue={props.valor ?? (registro ? ((registro[nome as keyof Registro] as string | null) ?? "") : "")}
        aria-invalid={erro(nome) ? true : undefined}
        aria-describedby={erro(nome) ? `e-${nome}` : undefined}
        autoComplete="off"
      />
      {props.ajuda ? <span className="ajuda">{props.ajuda}</span> : null}
      {erro(nome) ? (
        <span className="erro-campo" id={`e-${nome}`}>
          {erro(nome)}
        </span>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={enviar} className="formulario" noValidate>
      {registro ? <input type="hidden" name="num" value={registro.num} /> : null}

      {estado.erro ? (
        <p className="aviso aviso-erro c-12" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <fieldset>
        <legend>Proposta</legend>
        <div className="campo c-6">
          <label htmlFor="f-cliente">Cliente</label>
          <input
            id="f-cliente"
            name="cliente"
            type="text"
            list="lista-clientes"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            aria-invalid={erro("cliente") ? true : undefined}
            autoComplete="off"
            required
          />
          <datalist id="lista-clientes">
            {clientes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {clienteNovo ? (
            <span className="ajuda" style={{ color: "var(--alerta-texto)" }}>
              Cliente novo: será cadastrado como “{cliente.trim().toLocaleUpperCase("pt-BR")}”. Confira se não existe com outra grafia.
            </span>
          ) : (
            <span className="ajuda">Escolha da lista para não criar grafias duplicadas.</span>
          )}
          {registro?.empresa_original ? <span className="original">Grafia na planilha: “{registro.empresa_original}”</span> : null}
          {erro("cliente") ? <span className="erro-campo">{erro("cliente")}</span> : null}
        </div>
        {campoTexto("contato", "Contato no cliente", { ajuda: "Nome e telefone. Dado pessoal: visível só para usuários logados." })}
        <div className="campo c-12">
          <label htmlFor="f-escopo">Escopo</label>
          <textarea
            id="f-escopo"
            name="escopo"
            rows={3}
            defaultValue={registro?.escopo ?? ""}
            aria-invalid={erro("escopo") ? true : undefined}
          />
          {erro("escopo") ? <span className="erro-campo">{erro("escopo")}</span> : null}
        </div>
        {campoTexto("gerente", "Gerente de contrato (Cooesa)", { classe: "c-4", lista: "lista-gerente" })}
        <div className="campo c-4">
          <label htmlFor="f-situacao">Situação</label>
          <select id="f-situacao" name="situacao" defaultValue={registro?.situacao ?? (registro ? "" : "Proposta colocada")} aria-invalid={erro("situacao") ? true : undefined}>
            {registro && registro.situacao === null ? <option value="">— sem situação (legado) —</option> : null}
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {erro("situacao") ? <span className="erro-campo">{erro("situacao")}</span> : null}
        </div>
        <div className="campo c-4">
          <label htmlFor="f-entidade">Entidade</label>
          <select id="f-entidade" name="entidade" defaultValue={registro?.entidade ?? ""}>
            <option value="">Não informada</option>
            <option value="Cooesa Ltda">Cooesa Ltda</option>
            <option value="Cooperativa">Cooperativa</option>
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Datas e valores</legend>
        <div className="campo c-3">
          <label htmlFor="f-data_ini">Início</label>
          <input id="f-data_ini" name="data_ini" type="date" defaultValue={registro?.data_ini ?? ""} aria-invalid={erro("data_ini") ? true : undefined} />
          {registro?.data_ini_texto ? <span className="original">Planilha: “{registro.data_ini_texto}”</span> : null}
          {erro("data_ini") ? <span className="erro-campo">{erro("data_ini")}</span> : null}
        </div>
        <div className="campo c-3">
          <label htmlFor="f-data_enc">Encerramento</label>
          <input id="f-data_enc" name="data_enc" type="date" defaultValue={registro?.data_enc ?? ""} aria-invalid={erro("data_enc") ? true : undefined} />
          {registro?.data_enc_texto ? (
            <span className="original">
              Planilha: “{registro.data_enc_texto}” (assumido {formatarData(registro.data_enc)})
            </span>
          ) : null}
          {erro("data_enc") ? <span className="erro-campo">{erro("data_enc")}</span> : null}
        </div>
        <div className="campo c-3">
          <label htmlFor="f-ano">Ano</label>
          <input id="f-ano" name="ano" type="number" min={1990} max={2100} defaultValue={registro?.ano ?? ""} placeholder="do início" />
          {erro("ano") ? <span className="erro-campo">{erro("ano")}</span> : <span className="ajuda">Vazio = ano do início.</span>}
        </div>
        <div className="campo c-3">
          <span className="rotulo" id="rotulo-tipo">
            Tipo
          </span>
          <div role="radiogroup" aria-labelledby="rotulo-tipo" style={{ display: "flex", gap: 14, minHeight: 36, alignItems: "center" }}>
            <label className="checagem">
              <input type="radio" name="tipo" value="P" checked={tipo === "P"} onChange={() => setTipo("P")} /> P — total
            </label>
            <label className="checagem">
              <input type="radio" name="tipo" value="T" checked={tipo === "T"} onChange={() => setTipo("T")} /> T — mensal
            </label>
          </div>
        </div>
        <div className="campo c-6">
          <label htmlFor="f-valor">{tipo === "T" ? "Valor mensal (R$/mês)" : "Valor total da proposta (R$)"}</label>
          <input
            id="f-valor"
            name="valor"
            type="text"
            inputMode="decimal"
            defaultValue={valorParaCampo(registro?.valor)}
            placeholder="0,00"
            aria-invalid={erro("valor") ? true : undefined}
          />
          {registro?.valor_texto ? <span className="original">Planilha: “{registro.valor_texto}” (preservado)</span> : null}
          {erro("valor") ? <span className="erro-campo">{erro("valor")}</span> : null}
        </div>
        <div className="campo c-6">
          <label htmlFor="f-valor_vencedor">Valor do concorrente vencedor (R$)</label>
          <input
            id="f-valor_vencedor"
            name="valor_vencedor"
            type="text"
            inputMode="decimal"
            defaultValue={valorParaCampo(registro?.valor_vencedor)}
            placeholder="se conhecido"
          />
          {erro("valor_vencedor") ? <span className="erro-campo">{erro("valor_vencedor")}</span> : null}
        </div>
      </fieldset>

      {/* Sugestões do autocompletar (fora da seção que fecha, para valerem sempre) */}
      {(Object.keys(sugestoes) as (keyof Sugestoes)[]).map((nivel) => (
        <datalist key={nivel} id={`lista-${nivel}`}>
          {sugestoes[nivel].map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}

      {/* Opcional: começa fechada numa proposta nova (formulário mais curto no celular). */}
      <details className="c-12 secao-opcional" open={Boolean(registro?.setor || registro?.area || registro?.servico)}>
        <summary>Classificação (árvore de pesquisa) · opcional</summary>
        <fieldset>
          <legend className="sr-only">Classificação</legend>
          {campoTexto("setor", "A — Setor", { classe: "c-4", lista: "lista-setor" })}
          {campoTexto("area", "B — Área", { classe: "c-4", lista: "lista-area" })}
          {campoTexto("empreendimento", "C — Empreendimento", { classe: "c-4", lista: "lista-empreendimento" })}
          {campoTexto("servico", "D — Serviço", { classe: "c-6", lista: "lista-servico" })}
          {campoTexto("especialidade", "E — Especialidade", { classe: "c-6", lista: "lista-especialidade" })}
        </fieldset>
      </details>

      <div className="campo c-12">
        <label htmlFor="f-obs">Observações</label>
        <textarea id="f-obs" name="obs" rows={2} defaultValue={registro?.obs ?? ""} />
      </div>

      {revisaveis.length ? (
        <fieldset>
          <legend>Pendências deste registro</legend>
          <div className="c-12">
            {revisaveis.map((p) => (
              <label key={p.tipo} className="checagem" style={{ display: "flex", marginBottom: 6 }}>
                <input type="checkbox" name="revisar" value={p.tipo} />
                <span>
                  Marcar como revisada: <strong>{ROTULO_TIPO_PENDENCIA[p.tipo]}</strong> — {p.descricao}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="c-12 atalhos">
        <button className="btn btn-primario" type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : registro ? "Salvar alterações" : "Cadastrar proposta"}
        </button>
        <Link className="btn" href={registro ? `/registros/${registro.num}` : "/registros"}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
