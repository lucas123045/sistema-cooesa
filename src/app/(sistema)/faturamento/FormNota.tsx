"use client";

import Link from "next/link";
import { useFormAcao } from "@/components/useFormAcao";
import { valorParaCampo } from "@/lib/valores";
import { salvarNota, type EstadoNota } from "./acoes";

type NotaForm = {
  id?: number;
  numero?: string | null;
  data_emissao?: string | null;
  data_credito?: string | null;
  cliente_id?: number | null;
  empresa_texto?: string | null;
  titulo?: string | null;
  valor?: string | number | null;
  ano?: number | null;
  registro_num?: number | null;
  origem_aba?: string | null;
  origem_linha?: number | null;
};

function ErroCampo({ mensagem }: { mensagem?: string }) {
  return mensagem ? <span className="erro-campo">{mensagem}</span> : null;
}

export function FormNota({ nota, clientes }: { nota?: NotaForm; clientes: { id: number; nome: string }[] }) {
  const [estado, enviar, pendente] = useFormAcao<EstadoNota>(salvarNota, {});
  const erro = (c: string) => estado.campos?.[c];

  return (
    <form onSubmit={enviar} className="formulario painel-corpo" noValidate>
      {nota?.id ? <input type="hidden" name="id" value={nota.id} /> : null}
      {estado.erro ? (
        <p className="aviso aviso-erro c-12" role="alert">
          {estado.erro}
        </p>
      ) : null}
      {nota?.origem_aba ? (
        <p className="aviso c-12">
          Importada da planilha: aba “{nota.origem_aba}”, linha {nota.origem_linha}.
        </p>
      ) : null}

      <div className="campo c-4">
        <label htmlFor="numero">Número da NF</label>
        <input id="numero" name="numero" type="text" defaultValue={nota?.numero ?? ""} maxLength={80} />
        <ErroCampo mensagem={erro("numero")} />
      </div>
      <div className="campo c-4">
        <label htmlFor="data_emissao">Emissão</label>
        <input id="data_emissao" name="data_emissao" type="date" defaultValue={nota?.data_emissao ?? ""} aria-invalid={erro("data_emissao") ? true : undefined} />
        <ErroCampo mensagem={erro("data_emissao")} />
      </div>
      <div className="campo c-4">
        <label htmlFor="data_credito">Crédito</label>
        <input id="data_credito" name="data_credito" type="date" defaultValue={nota?.data_credito ?? ""} aria-invalid={erro("data_credito") ? true : undefined} />
        <span className="ajuda">Vazio = a receber.</span>
        <ErroCampo mensagem={erro("data_credito")} />
      </div>
      <div className="campo c-6">
        <label htmlFor="cliente_id">Cliente cadastrado</label>
        <select id="cliente_id" name="cliente_id" defaultValue={nota?.cliente_id ?? ""}>
          <option value="">— não vinculado —</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <ErroCampo mensagem={erro("cliente_id")} />
      </div>
      <div className="campo c-6">
        <label htmlFor="empresa_texto">Empresa como aparece na nota</label>
        <input id="empresa_texto" name="empresa_texto" type="text" defaultValue={nota?.empresa_texto ?? ""} maxLength={240} />
        <span className="ajuda">Texto original; fica preservado mesmo depois de vincular o cliente.</span>
      </div>
      <div className="campo c-12">
        <label htmlFor="titulo">Título / referência</label>
        <input id="titulo" name="titulo" type="text" defaultValue={nota?.titulo ?? ""} maxLength={500} />
      </div>
      <div className="campo c-4">
        <label htmlFor="valor">Valor (R$)</label>
        <input
          id="valor"
          name="valor"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={valorParaCampo(nota?.valor)}
          aria-invalid={erro("valor") ? true : undefined}
        />
        <ErroCampo mensagem={erro("valor")} />
      </div>
      <div className="campo c-4">
        <label htmlFor="ano">Ano de referência</label>
        <input id="ano" name="ano" type="number" min={1990} max={2100} defaultValue={nota?.ano ?? new Date().getFullYear()} />
        <ErroCampo mensagem={erro("ano")} />
      </div>
      <div className="campo c-4">
        <label htmlFor="registro_num">Registro (Nº da proposta)</label>
        <input id="registro_num" name="registro_num" type="number" min={1} defaultValue={nota?.registro_num ?? ""} aria-invalid={erro("registro_num") ? true : undefined} />
        <ErroCampo mensagem={erro("registro_num")} />
      </div>
      <div className="c-12 atalhos">
        <button className="btn btn-primario" type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar nota fiscal"}
        </button>
        <Link className="btn" href={nota?.ano ? `/faturamento?ano=${nota.ano}` : "/faturamento"}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
