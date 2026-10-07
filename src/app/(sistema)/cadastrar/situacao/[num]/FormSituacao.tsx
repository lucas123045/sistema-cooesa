"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormAcao } from "@/components/useFormAcao";
import { MOTIVOS_PERDA } from "@/lib/propostas";
import { eContratoTotal, grupoDe, SITUACOES } from "@/lib/situacoes";
import { atualizarSituacao, type EstadoSituacao } from "../acoes";

const AJUDA: Record<string, string> = {
  "Proposta colocada": "Enviada, aguardando resposta do cliente",
  "Proposta colocada - negativa": "O cliente escolheu outra empresa ou desistiu",
  "Proposta cancelada": "A proposta foi retirada ou o processo cancelado",
  "Proposta em litígio": "Proposta em disputa",
  "Contrato em andamento": "Ganhamos: o contrato está em execução",
  "Contrato encerrado": "O contrato foi concluído",
  "Contrato em litígio": "Contrato em disputa",
};

export function FormSituacao(props: {
  num: number;
  situacaoAtual: string | null;
  statusEmpresa: string | null;
  nomeEmpresa: string;
}) {
  const [estado, enviar, pendente] = useFormAcao<EstadoSituacao>(atualizarSituacao, {});
  const [situacao, setSituacao] = useState(props.situacaoAtual ?? "");
  const erro = (c: string) => (estado.campos?.[c] ? <span className="erro-campo">{estado.campos[c]}</span> : null);
  const perdida = situacao === "Proposta colocada - negativa" || situacao === "Proposta cancelada";
  const virouContrato = eContratoTotal(situacao) && !eContratoTotal(props.situacaoAtual);
  const podeAtivarEmpresa = virouContrato && props.statusEmpresa !== "Cliente ativo" && props.statusEmpresa !== "Não atender";

  return (
    <form onSubmit={enviar} className="painel" noValidate>
      <input type="hidden" name="num" value={props.num} />
      <div className="painel-corpo pilha">
        {estado.erro ? (
          <p className="aviso aviso-erro" role="alert">
            {estado.erro}
          </p>
        ) : null}

        <fieldset className="escolha-situacao">
          <legend>Nova situação</legend>
          {SITUACOES.map((s) => (
            <label key={s} className={`opcao-situacao grupo-${grupoDe(s)}${situacao === s ? " escolhida" : ""}`}>
              <input type="radio" name="situacao" value={s} checked={situacao === s} onChange={() => setSituacao(s)} />
              <span>
                <strong>{s}</strong>
                <span className="sub">
                  {AJUDA[s]}
                  {s === props.situacaoAtual ? " · situação atual" : ""}
                </span>
              </span>
            </label>
          ))}
          {erro("situacao")}
        </fieldset>

        {situacao === "Contrato encerrado" ? (
          <div className="campo" style={{ maxWidth: 260 }}>
            <label htmlFor="s-data_enc">Data de encerramento</label>
            <input id="s-data_enc" name="data_enc" type="date" />
            {erro("data_enc")}
          </div>
        ) : null}

        {perdida ? (
          <div className="formulario">
            <div className="campo c-6">
              <label htmlFor="s-motivo">Motivo</label>
              <select id="s-motivo" name="motivo_perda" defaultValue="">
                <option value="">—</option>
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <span className="ajuda">Ajuda a entender, em Resultados, por que as propostas são perdidas.</span>
              {erro("motivo_perda")}
            </div>
            <div className="campo c-6">
              <label htmlFor="s-vencedor">Valor do vencedor (R$), se souber</label>
              <input id="s-vencedor" name="valor_vencedor" type="text" inputMode="decimal" placeholder="0,00" />
              {erro("valor_vencedor")}
            </div>
          </div>
        ) : null}

        <div className="campo">
          <label htmlFor="s-anotacao">Anotação (opcional)</label>
          <textarea
            id="s-anotacao"
            name="anotacao"
            rows={3}
            placeholder="Ex.: cliente confirmou por e-mail em 12/10; início previsto para novembro."
          />
          <span className="ajuda">A mudança de situação fica registrada nos acompanhamentos da proposta, com esta anotação.</span>
        </div>

        {podeAtivarEmpresa ? (
          <label className="checagem">
            <input type="checkbox" name="atualizar_empresa" value="1" defaultChecked /> Mudar o status de {props.nomeEmpresa} para
            Cliente ativo
          </label>
        ) : null}
      </div>
      <div className="assistente-rodape">
        <Link className="btn btn-texto" href="/cadastrar/situacao">
          Cancelar
        </Link>
        <button className="btn btn-primario" type="submit" disabled={pendente || !situacao || situacao === props.situacaoAtual}>
          {pendente ? "Salvando…" : "Salvar situação"}
        </button>
      </div>
    </form>
  );
}
