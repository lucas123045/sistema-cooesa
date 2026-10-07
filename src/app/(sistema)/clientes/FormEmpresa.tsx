"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormAcao } from "@/components/useFormAcao";
import { formatarCnpj, somenteDigitos, STATUS_EMPRESA, UFS } from "@/lib/empresas";
import { ORIGENS_SUGERIDAS } from "@/lib/empresas-esquema";
import { normalizarBusca } from "@/lib/formato";
import type { LinhaCliente } from "@/lib/tipos";
import { salvarEmpresa, type EstadoEmpresa } from "./acoes";

type Existente = { id: number; nome: string; cnpj: string | null };

type Props = {
  empresa?: LinhaCliente;
  existentes: Existente[];
  setores: string[];
  responsaveis: string[];
  podeRenomear: boolean;
};

const chave = (t: string) => normalizarBusca(t).replace(/[^a-z0-9]/g, "");

/** Empresas com nome parecido: igual sem acento/pontuação, ou um nome começando pelo outro. */
function parecidas(nome: string, existentes: Existente[], proprioId?: number) {
  const k = chave(nome);
  if (k.length < 2) return [];
  return existentes
    .filter((e) => e.id !== proprioId)
    .filter((e) => {
      const o = chave(e.nome);
      return o === k || (Math.min(o.length, k.length) >= 3 && (o.startsWith(k) || k.startsWith(o)));
    })
    .slice(0, 5);
}

function ErroCampo({ mensagem }: { mensagem?: string }) {
  return mensagem ? <span className="erro-campo">{mensagem}</span> : null;
}

export function FormEmpresa({ empresa, existentes, setores, responsaveis, podeRenomear }: Props) {
  const [estado, enviar, pendente] = useFormAcao<EstadoEmpresa>(salvarEmpresa, {});
  const [nome, setNome] = useState(empresa?.nome ?? "");
  const [cnpj, setCnpj] = useState(empresa?.cnpj ? formatarCnpj(empresa.cnpj) : "");
  const erro = (c: string) => estado.campos?.[c];
  const nomeTravado = Boolean(empresa) && !podeRenomear;

  const similares = useMemo(
    () => (nomeTravado || nome === empresa?.nome ? [] : parecidas(nome, existentes, empresa?.id)),
    [nome, existentes, empresa, nomeTravado],
  );
  const cnpjRepetido = useMemo(() => {
    const d = somenteDigitos(cnpj);
    return d.length === 14 ? existentes.find((e) => e.cnpj === d && e.id !== empresa?.id) : undefined;
  }, [cnpj, existentes, empresa]);

  const campo = (
    nomeCampo: string,
    rotulo: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { classe?: string; ajuda?: string } = {},
  ) => {
    const { classe, ajuda, ...input } = props;
    return (
      <div className={`campo ${classe ?? "c-6"}`}>
        <label htmlFor={`e-${nomeCampo}`}>{rotulo}</label>
        <input
          id={`e-${nomeCampo}`}
          name={nomeCampo}
          type="text"
          defaultValue={(empresa?.[nomeCampo as keyof LinhaCliente] as string | null) ?? ""}
          aria-invalid={erro(nomeCampo) ? true : undefined}
          autoComplete="off"
          {...input}
        />
        {ajuda ? <span className="ajuda">{ajuda}</span> : null}
        <ErroCampo mensagem={erro(nomeCampo)} />
      </div>
    );
  };

  return (
    <form onSubmit={enviar} className="formulario" noValidate>
      {empresa ? <input type="hidden" name="id" value={empresa.id} /> : null}
      {estado.erro ? (
        <p className="aviso aviso-erro c-12" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <fieldset>
        <legend>Identificação</legend>
        <div className="campo c-6">
          <label htmlFor="e-nome">Nome da empresa</label>
          <input
            id="e-nome"
            name="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            readOnly={nomeTravado}
            aria-invalid={erro("nome") ? true : undefined}
            autoComplete="off"
            required
          />
          <span className="ajuda">
            {nomeTravado
              ? "Só administradores renomeiam (o nome é usado em todo o acervo)."
              : "Nome curto usado no sistema, ex.: CPFL."}
          </span>
          <ErroCampo mensagem={erro("nome")} />
          {similares.length ? (
            <div className="aviso aviso-alerta pequeno" role="status" style={{ marginTop: 6 }}>
              Já existe empresa parecida:{" "}
              {similares.map((s, i) => (
                <span key={s.id}>
                  {i ? ", " : ""}
                  <Link href={`/clientes/${s.id}`} target="_blank">
                    {s.nome}
                  </Link>
                </span>
              ))}
              . Confira antes de cadastrar outra.
            </div>
          ) : null}
        </div>
        {campo("razao_social", "Razão social", { classe: "c-6" })}
        <div className="campo c-6">
          <label htmlFor="e-cnpj">CNPJ</label>
          <input
            id="e-cnpj"
            name="cnpj"
            type="text"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            onBlur={() => somenteDigitos(cnpj).length === 14 && setCnpj(formatarCnpj(cnpj))}
            aria-invalid={erro("cnpj") ? true : undefined}
            autoComplete="off"
          />
          <ErroCampo mensagem={erro("cnpj")} />
          {cnpjRepetido ? (
            <span className="erro-campo">
              Esse CNPJ já está em{" "}
              <Link href={`/clientes/${cnpjRepetido.id}`} target="_blank">
                {cnpjRepetido.nome}
              </Link>
              .
            </span>
          ) : null}
        </div>
      </fieldset>

      <fieldset>
        <legend>Relacionamento</legend>
        <div className="campo c-6">
          <label htmlFor="e-status">Status</label>
          <select id="e-status" name="status" defaultValue={empresa?.status ?? empresa?.status_sugerido ?? "Prospecção"}>
            {STATUS_EMPRESA.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {empresa && !empresa.status && empresa.status_sugerido ? (
            <span className="ajuda">Sem status ainda. Sugestão do sistema: {empresa.status_sugerido}.</span>
          ) : null}
          <ErroCampo mensagem={erro("status")} />
        </div>
        {campo("responsavel", "Responsável na Cooesa", { classe: "c-6", list: "lista-responsaveis" })}
        {campo("setor", "Setor", { classe: "c-6", list: "lista-setores" })}
        {campo("origem", "Como chegou", { classe: "c-6", list: "lista-origens", placeholder: "Indicação, licitação…" })}
        <datalist id="lista-responsaveis">
          {responsaveis.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <datalist id="lista-setores">
          {setores.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <datalist id="lista-origens">
          {ORIGENS_SUGERIDAS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </fieldset>

      <fieldset>
        <legend>Localização</legend>
        {campo("cidade", "Cidade", { classe: "c-6" })}
        <div className="campo c-3">
          <label htmlFor="e-uf">UF</label>
          <select id="e-uf" name="uf" defaultValue={empresa?.uf ?? ""}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <ErroCampo mensagem={erro("uf")} />
        </div>
        {campo("site", "Site", { classe: "c-3", placeholder: "empresa.com.br", inputMode: "url" })}
      </fieldset>

      <div className="campo c-12">
        <label htmlFor="e-observacoes">Observações</label>
        <textarea id="e-observacoes" name="observacoes" rows={3} defaultValue={empresa?.observacoes ?? ""} />
        <ErroCampo mensagem={erro("observacoes")} />
      </div>

      <div className="c-12 atalhos">
        <button className="btn btn-primario" type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : empresa ? "Salvar alterações" : "Cadastrar empresa"}
        </button>
        <Link className="btn" href={empresa ? `/clientes/${empresa.id}` : "/clientes"}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
