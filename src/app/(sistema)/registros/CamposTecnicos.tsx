"use client";

import { useState } from "react";
import { UFS } from "@/lib/empresas";
import { caracteristicasDaArea, MODALIDADES, MOTIVOS_PERDA } from "@/lib/propostas";
import type { DadosTecnicosRegistro } from "@/lib/tipos";

/**
 * Campos técnicos e comerciais da proposta — usados no cadastro (/cadastrar/proposta)
 * e na edição. O formulário que os usa deve ter <input name="com_tecnicos" value="1">.
 */

type Valores = Partial<DadosTecnicosRegistro>;
type Comum = { valores?: Valores; erros?: Record<string, string> };

/** Número para o campo, com vírgula decimal e sem zeros inventados (138 → "138"; 32.5 → "32,5"). */
const numeroCampo = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v)).replace(".", ",");

function Campo(props: {
  nome: keyof DadosTecnicosRegistro;
  rotulo: string;
  classe?: string;
  ajuda?: string;
  erros?: Record<string, string>;
  children: React.ReactNode;
}) {
  const erro = props.erros?.[props.nome];
  return (
    <div className={`campo ${props.classe ?? "c-6"}`}>
      <label htmlFor={`t-${props.nome}`}>{props.rotulo}</label>
      {props.children}
      {props.ajuda && !erro ? <span className="ajuda">{props.ajuda}</span> : null}
      {erro ? <span className="erro-campo">{erro}</span> : null}
    </div>
  );
}

/** Objeto técnico: obra, local, cliente final e características conforme a área. */
export function CamposObjetoTecnico({ valores, erros, area }: Comum & { area: string }) {
  const relevantes = caracteristicasDaArea(area);
  const [todas, setTodas] = useState(false);
  // Campo já preenchido sempre aparece, mesmo fora da área.
  const mostrar = (k: "potencia" | "tensao" | "extensao", v: unknown) =>
    todas || relevantes[k] || (v !== null && v !== undefined && v !== "");
  const algumOculto =
    !todas &&
    (!mostrar("potencia", valores?.potencia_mw) ||
      !mostrar("tensao", valores?.tensao_kv) ||
      !mostrar("extensao", valores?.extensao_km));
  const inv = (k: string) => (erros?.[k] ? true : undefined);

  return (
    <>
      <Campo
        nome="obra"
        rotulo="Obra / empreendimento"
        ajuda="Ex.: UHE Porto Primavera, LT 230 kV Pau Ferro – Fiat"
        erros={erros}
        classe="c-8"
      >
        <input id="t-obra" name="obra" type="text" defaultValue={valores?.obra ?? ""} aria-invalid={inv("obra")} />
      </Campo>
      <Campo
        nome="cliente_final"
        rotulo="Cliente final"
        ajuda="Se a proposta é feita por intermediário"
        erros={erros}
        classe="c-4"
      >
        <input id="t-cliente_final" name="cliente_final" type="text" defaultValue={valores?.cliente_final ?? ""} />
      </Campo>
      <Campo nome="local_municipio" rotulo="Município da obra" erros={erros} classe="c-8">
        <input id="t-local_municipio" name="local_municipio" type="text" defaultValue={valores?.local_municipio ?? ""} />
      </Campo>
      <Campo nome="local_uf" rotulo="UF" erros={erros} classe="c-4">
        <select id="t-local_uf" name="local_uf" defaultValue={valores?.local_uf ?? ""} aria-invalid={inv("local_uf")}>
          <option value="">—</option>
          {UFS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </Campo>
      {mostrar("potencia", valores?.potencia_mw) ? (
        <Campo nome="potencia_mw" rotulo="Potência (MW)" erros={erros} classe="c-4">
          <input
            id="t-potencia_mw"
            name="potencia_mw"
            type="text"
            inputMode="decimal"
            defaultValue={numeroCampo(valores?.potencia_mw)}
            aria-invalid={inv("potencia_mw")}
          />
        </Campo>
      ) : (
        <input type="hidden" name="potencia_mw" value="" />
      )}
      {mostrar("tensao", valores?.tensao_kv) ? (
        <Campo nome="tensao_kv" rotulo="Tensão (kV)" erros={erros} classe="c-4">
          <input
            id="t-tensao_kv"
            name="tensao_kv"
            type="text"
            inputMode="decimal"
            defaultValue={numeroCampo(valores?.tensao_kv)}
            aria-invalid={inv("tensao_kv")}
          />
        </Campo>
      ) : (
        <input type="hidden" name="tensao_kv" value="" />
      )}
      {mostrar("extensao", valores?.extensao_km) ? (
        <Campo nome="extensao_km" rotulo="Extensão (km)" erros={erros} classe="c-4">
          <input
            id="t-extensao_km"
            name="extensao_km"
            type="text"
            inputMode="decimal"
            defaultValue={numeroCampo(valores?.extensao_km)}
            aria-invalid={inv("extensao_km")}
          />
        </Campo>
      ) : (
        <input type="hidden" name="extensao_km" value="" />
      )}
      {algumOculto ? (
        <div className="c-12">
          <button type="button" className="btn btn-texto btn-pequeno" onClick={() => setTodas(true)}>
            Mostrar potência, tensão e extensão
          </button>
        </div>
      ) : null}
      <Campo
        nome="descricao"
        rotulo="Descrição técnica"
        ajuda="Escopo detalhado, normas, entregáveis"
        erros={erros}
        classe="c-12"
      >
        <textarea id="t-descricao" name="descricao" rows={4} defaultValue={valores?.descricao ?? ""} />
      </Campo>
    </>
  );
}

/** Dados comerciais: modalidade, edital, revisão, validade, prazo, Hh, responsável técnico, concorrentes. */
export function CamposComerciais({ valores, erros }: Comum) {
  const inv = (k: string) => (erros?.[k] ? true : undefined);
  return (
    <>
      <Campo nome="modalidade" rotulo="Modalidade" erros={erros} classe="c-4">
        <select id="t-modalidade" name="modalidade" defaultValue={valores?.modalidade ?? ""} aria-invalid={inv("modalidade")}>
          <option value="">—</option>
          {MODALIDADES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Campo>
      <Campo nome="edital" rotulo="Nº do edital / processo" erros={erros} classe="c-4">
        <input id="t-edital" name="edital" type="text" defaultValue={valores?.edital ?? ""} />
      </Campo>
      <Campo nome="revisao" rotulo="Revisão" ajuda="0 = R0" erros={erros} classe="c-4">
        <input
          id="t-revisao"
          name="revisao"
          type="text"
          inputMode="numeric"
          defaultValue={String(valores?.revisao ?? 0)}
          aria-invalid={inv("revisao")}
        />
      </Campo>
      <Campo nome="validade_dias" rotulo="Validade (dias)" erros={erros} classe="c-4">
        <input
          id="t-validade_dias"
          name="validade_dias"
          type="text"
          inputMode="numeric"
          defaultValue={numeroCampo(valores?.validade_dias)}
          aria-invalid={inv("validade_dias")}
        />
      </Campo>
      <Campo nome="prazo_meses" rotulo="Prazo de execução (meses)" erros={erros} classe="c-4">
        <input
          id="t-prazo_meses"
          name="prazo_meses"
          type="text"
          inputMode="decimal"
          defaultValue={numeroCampo(valores?.prazo_meses)}
          aria-invalid={inv("prazo_meses")}
        />
      </Campo>
      <Campo nome="horas_estimadas" rotulo="Homem-hora estimado (Hh)" erros={erros} classe="c-4">
        <input
          id="t-horas_estimadas"
          name="horas_estimadas"
          type="text"
          inputMode="numeric"
          defaultValue={numeroCampo(valores?.horas_estimadas)}
          aria-invalid={inv("horas_estimadas")}
        />
      </Campo>
      <Campo
        nome="responsavel_tecnico"
        rotulo="Responsável técnico"
        ajuda="Engenheiro(a) responsável pela proposta"
        erros={erros}
        classe="c-6"
      >
        <input
          id="t-responsavel_tecnico"
          name="responsavel_tecnico"
          type="text"
          defaultValue={valores?.responsavel_tecnico ?? ""}
        />
      </Campo>
      <Campo nome="concorrentes" rotulo="Concorrentes conhecidos" erros={erros} classe="c-6">
        <input id="t-concorrentes" name="concorrentes" type="text" defaultValue={valores?.concorrentes ?? ""} />
      </Campo>
    </>
  );
}

/** Motivo da perda (para propostas perdidas ou canceladas). */
export function CampoMotivoPerda({ valores, erros }: Comum) {
  return (
    <Campo
      nome="motivo_perda"
      rotulo="Motivo da perda"
      ajuda="Quando a proposta foi perdida ou cancelada"
      erros={erros}
      classe="c-6"
    >
      <select id="t-motivo_perda" name="motivo_perda" defaultValue={valores?.motivo_perda ?? ""}>
        <option value="">—</option>
        {MOTIVOS_PERDA.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
    </Campo>
  );
}
