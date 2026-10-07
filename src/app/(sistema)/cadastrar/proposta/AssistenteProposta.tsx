"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SeloStatusEmpresa } from "@/components/SeloStatusEmpresa";
import { useFormAcao } from "@/components/useFormAcao";
import { formatarMoeda, normalizarBusca } from "@/lib/formato";
import { normalizarNomeCliente } from "@/lib/registros/esquema";
import type { Sugestoes } from "@/lib/registros/sugestoes";
import { SITUACOES } from "@/lib/situacoes";
import { lerValorBR } from "@/lib/valores";
import { salvarRegistro, type EstadoRegistro } from "../../registros/acoes";
import { CampoMotivoPerda, CamposComerciais, CamposObjetoTecnico } from "../../registros/CamposTecnicos";

export type EmpresaOpcao = { id: number; nome: string; status: string | null };
export type PropostaRecente = { num: number; cliente: string; escopo: string | null; ano: number };

type Props = {
  empresas: EmpresaOpcao[];
  sugestoes: Sugestoes;
  recentes: PropostaRecente[];
  clienteInicial: string;
  hoje: string;
};

const PASSOS = ["Cliente", "Objeto técnico", "Proposta comercial", "Revisão"] as const;
const CHAVE_RASCUNHO = "cooesa-rascunho-proposta";

/** Em que etapa cada campo está — para levar o usuário ao erro que o servidor apontar. */
const PASSO_DO_CAMPO: Record<string, number> = {
  cliente: 0,
  contato: 0,
  gerente: 0,
  entidade: 0,
  escopo: 1,
  setor: 1,
  area: 1,
  empreendimento: 1,
  servico: 1,
  especialidade: 1,
  obra: 1,
  cliente_final: 1,
  local_municipio: 1,
  local_uf: 1,
  potencia_mw: 1,
  tensao_kv: 1,
  extensao_km: 1,
  descricao: 1,
};

/** Rótulos legíveis para a tela de revisão. */
const ROTULOS: [string, string][] = [
  ["cliente", "Cliente"],
  ["contato", "Contato no cliente"],
  ["gerente", "Gerente de contrato"],
  ["entidade", "Entidade"],
  ["escopo", "Escopo"],
  ["obra", "Obra / empreendimento"],
  ["cliente_final", "Cliente final"],
  ["local_municipio", "Município"],
  ["local_uf", "UF"],
  ["setor", "Setor"],
  ["area", "Área"],
  ["empreendimento", "Empreendimento"],
  ["servico", "Serviço"],
  ["especialidade", "Especialidade"],
  ["potencia_mw", "Potência (MW)"],
  ["tensao_kv", "Tensão (kV)"],
  ["extensao_km", "Extensão (km)"],
  ["descricao", "Descrição técnica"],
  ["data_ini", "Data da proposta"],
  ["situacao", "Situação"],
  ["tipo", "Tipo"],
  ["valor", "Valor"],
  ["modalidade", "Modalidade"],
  ["edital", "Edital / processo"],
  ["revisao", "Revisão"],
  ["validade_dias", "Validade (dias)"],
  ["prazo_meses", "Prazo (meses)"],
  ["horas_estimadas", "Homem-hora (Hh)"],
  ["responsavel_tecnico", "Responsável técnico"],
  ["concorrentes", "Concorrentes"],
  ["valor_vencedor", "Valor do vencedor"],
  ["motivo_perda", "Motivo da perda"],
  ["obs", "Observações"],
];

const chave = (t: string) => normalizarBusca(t).replace(/[^a-z0-9 ]/g, "");

function lerRascunho(): { campos: Record<string, string>; passo: number; quando: number } | null {
  try {
    const bruto = localStorage.getItem(CHAVE_RASCUNHO);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function AssistenteProposta({ empresas, sugestoes, recentes, clienteInicial, hoje }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [passo, setPasso] = useState(0);
  const [erroLocal, setErroLocal] = useState<Record<string, string>>({});
  const [chaveEnvio] = useState(() => crypto.randomUUID());
  const [rascunho, setRascunho] = useState<ReturnType<typeof lerRascunho>>(null);
  const [revisao, setRevisao] = useState<[string, string][]>([]);

  // Campos que mudam a tela enquanto o usuário digita.
  const [cliente, setCliente] = useState(clienteInicial);
  const [escopo, setEscopo] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState<"P" | "T">("P");
  const [situacao, setSituacao] = useState("Proposta colocada");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");

  const [estado, enviarAcao, pendente] = useFormAcao<EstadoRegistro>(salvarRegistro, {});
  const erros = { ...erroLocal, ...(estado.campos ?? {}) };

  // Oferece o rascunho salvo (só depois de montar: localStorage não existe no servidor).
  useEffect(() => {
    const r = lerRascunho();
    if (r && Object.values(r.campos).some((v) => v && v !== hoje && v !== "0" && v !== "Proposta colocada" && v !== "P")) {
      setRascunho(r); // eslint-disable-line react-hooks/set-state-in-effect -- leitura única de armazenamento externo
    }
  }, [hoje]);

  // Erro vindo do servidor: leva à etapa do primeiro campo com problema.
  useEffect(() => {
    const campos = Object.keys(estado.campos ?? {});
    if (!campos.length) return;
    const destino = Math.min(...campos.map((c) => PASSO_DO_CAMPO[c] ?? 2));
    setPasso(destino); // eslint-disable-line react-hooks/set-state-in-effect -- reação ao retorno do servidor
  }, [estado]);

  useEffect(() => {
    titulo.current?.focus();
  }, [passo]);

  const empresa = useMemo(() => {
    const nome = normalizarNomeCliente(cliente);
    return empresas.find((e) => e.nome === nome);
  }, [cliente, empresas]);

  const parecidas = useMemo(() => {
    const k = chave(cliente).replace(/ /g, "");
    if (empresa || k.length < 3) return [];
    return empresas
      .filter((e) => {
        const o = chave(e.nome).replace(/ /g, "");
        return o.startsWith(k) || k.startsWith(o);
      })
      .slice(0, 4);
  }, [cliente, empresa, empresas]);

  // Mesma empresa + escopo parecido nos últimos 2 anos.
  const repetidas = useMemo(() => {
    if (!empresa || chave(escopo).length < 6) return [];
    const palavras = chave(escopo)
      .split(" ")
      .filter((p) => p.length > 3);
    return recentes
      .filter((r) => r.cliente === empresa.nome && r.escopo)
      .filter((r) => {
        const alvo = chave(r.escopo!);
        const comuns = palavras.filter((p) => alvo.includes(p)).length;
        return palavras.length > 0 && comuns / palavras.length >= 0.6;
      })
      .slice(0, 3);
  }, [empresa, escopo, recentes]);

  const salvarRascunho = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aoDigitar = () => {
    clearTimeout(salvarRascunho.current);
    salvarRascunho.current = setTimeout(() => {
      if (!form.current) return;
      const campos: Record<string, string> = {};
      new FormData(form.current).forEach((v, k) => {
        if (k !== "chave_envio" && typeof v === "string") campos[k] = v;
      });
      try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ campos, passo, quando: Date.now() }));
      } catch {
        // sem armazenamento local: segue sem rascunho
      }
    }, 400);
  };

  function restaurar() {
    if (!rascunho || !form.current) return;
    for (const [nome, valorCampo] of Object.entries(rascunho.campos)) {
      form.current
        .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${CSS.escape(nome)}"]`)
        .forEach((el) => {
          if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox"))
            el.checked = el.value === valorCampo;
          else if (!(el instanceof HTMLInputElement && el.type === "hidden")) el.value = valorCampo;
        });
    }
    const c = rascunho.campos;
    setCliente(c.cliente ?? "");
    setEscopo(c.escopo ?? "");
    setArea(c.area ?? "");
    setTipo(c.tipo === "T" ? "T" : "P");
    setSituacao(c.situacao || "Proposta colocada");
    setValor(c.valor ?? "");
    setPrazo(c.prazo_meses ?? "");
    setPasso(Math.min(rascunho.passo ?? 0, 2));
    setRascunho(null);
  }

  function descartar() {
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {}
    setRascunho(null);
  }

  /** Valida a etapa atual antes de avançar (o servidor revalida tudo no fim). */
  function validar(etapa: number): boolean {
    const f = form.current!;
    const v = (n: string) => String(new FormData(f).get(n) ?? "").trim();
    const e: Record<string, string> = {};
    if (etapa === 0 && !v("cliente")) e.cliente = "Escolha ou digite a empresa.";
    if (etapa === 1 && !v("escopo")) e.escopo = "Descreva o escopo da proposta.";
    if (etapa === 2) {
      if (!v("situacao")) e.situacao = "Escolha a situação.";
      if (v("valor") && Number.isNaN(lerValorBR(v("valor")))) e.valor = "Valor inválido. Use 1.234,56.";
      if (v("valor_vencedor") && Number.isNaN(lerValorBR(v("valor_vencedor")))) e.valor_vencedor = "Valor inválido.";
    }
    setErroLocal(e);
    return Object.keys(e).length === 0;
  }

  function montarRevisao() {
    const dados = new FormData(form.current!);
    const linhas: [string, string][] = [];
    for (const [nome, rotulo] of ROTULOS) {
      let v = String(dados.get(nome) ?? "").trim();
      if (!v || (nome === "revisao" && v === "0")) continue;
      if (nome === "tipo") v = v === "T" ? "T — valor mensal" : "P — valor total";
      if (nome === "valor" || nome === "valor_vencedor") {
        const n = lerValorBR(v);
        v = n === null || Number.isNaN(n) ? v : `${formatarMoeda(n)}${nome === "valor" && tipo === "T" ? "/mês" : ""}`;
      }
      if (nome === "data_ini") v = v.split("-").reverse().join("/");
      if (nome === "cliente") v = normalizarNomeCliente(v) + (empresa ? "" : " (empresa nova)");
      linhas.push([rotulo, v]);
    }
    setRevisao(linhas);
  }

  function irPara(destino: number) {
    if (destino > passo) {
      for (let p = passo; p < destino; p++) if (!validar(p)) return setPasso(p);
      if (destino === 3) montarRevisao();
    } else setErroLocal({});
    setPasso(destino);
  }

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (passo < 3) {
      // Enter numa etapa intermediária avança, em vez de enviar.
      e.preventDefault();
      irPara(passo + 1);
      return;
    }
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {}
    enviarAcao(e);
  }

  const perdida = situacao === "Proposta colocada - negativa" || situacao === "Proposta cancelada";
  const totalEstimado = tipo === "T" ? (lerValorBR(valor) ?? NaN) * (lerValorBR(prazo) ?? NaN) : NaN;
  const erro = (c: string) => (erros[c] ? <span className="erro-campo">{erros[c]}</span> : null);

  return (
    <div className="assistente">
      {rascunho ? (
        <div className="aviso aviso-alerta atalhos">
          <span>
            Há um rascunho de proposta salvo neste aparelho (
            {new Date(rascunho.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}).
          </span>
          <button type="button" className="btn btn-pequeno btn-primario" onClick={restaurar}>
            Continuar rascunho
          </button>
          <button type="button" className="btn btn-pequeno btn-texto" onClick={descartar}>
            Descartar
          </button>
        </div>
      ) : null}

      <ol className="passos" aria-label="Etapas">
        {PASSOS.map((rotulo, i) => (
          <li key={rotulo} aria-current={i === passo ? "step" : undefined} className={i < passo ? "feito" : undefined}>
            <button type="button" onClick={() => irPara(i)} disabled={pendente}>
              <span className="passo-numero">{i + 1}</span>
              <span className="passo-rotulo">{rotulo}</span>
            </button>
          </li>
        ))}
      </ol>

      <form ref={form} onSubmit={aoEnviar} onInput={aoDigitar} className="painel" noValidate>
        <input type="hidden" name="chave_envio" value={chaveEnvio} />
        <input type="hidden" name="com_tecnicos" value="1" />
        <input type="hidden" name="ano" value="" />

        <div className="painel-corpo">
          <h2 ref={titulo} tabIndex={-1} className="assistente-titulo">
            {passo + 1}. {PASSOS[passo]}
          </h2>
          {estado.erro ? (
            <p className="aviso aviso-erro" role="alert">
              {estado.erro}
            </p>
          ) : null}

          {/* 1. Cliente */}
          <section hidden={passo !== 0} className="formulario">
            <div className="campo c-12">
              <label htmlFor="p-cliente">Empresa</label>
              <input
                id="p-cliente"
                name="cliente"
                type="text"
                list="p-lista-empresas"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                autoComplete="off"
                aria-invalid={erros.cliente ? true : undefined}
                placeholder="Comece a digitar o nome"
              />
              <datalist id="p-lista-empresas">
                {empresas.map((e) => (
                  <option key={e.id} value={e.nome} />
                ))}
              </datalist>
              {erro("cliente")}
              {empresa ? (
                <span className="ajuda">
                  Empresa cadastrada · <SeloStatusEmpresa status={empresa.status} />{" "}
                  <Link href={`/clientes/${empresa.id}`} target="_blank">
                    ver cadastro
                  </Link>
                </span>
              ) : cliente.trim() ? (
                <span className="ajuda" style={{ color: "var(--alerta-texto)" }}>
                  Empresa nova: será cadastrada como “{normalizarNomeCliente(cliente)}”, com status Proposta em andamento.
                  {parecidas.length ? (
                    <>
                      {" "}
                      Parecidas já cadastradas:{" "}
                      {parecidas.map((p, i) => (
                        <span key={p.id}>
                          {i ? ", " : ""}
                          <button type="button" className="link-botao" onClick={() => setCliente(p.nome)}>
                            {p.nome}
                          </button>
                        </span>
                      ))}
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>
            <div className="campo c-6">
              <label htmlFor="p-contato">Contato no cliente</label>
              <input id="p-contato" name="contato" type="text" placeholder="Nome e telefone" autoComplete="off" />
              <span className="ajuda">Dado pessoal: aparece só no detalhe da proposta.</span>
            </div>
            <div className="campo c-6">
              <label htmlFor="p-gerente">Gerente de contrato (Cooesa)</label>
              <input id="p-gerente" name="gerente" type="text" list="p-lista-gerente" autoComplete="off" />
              <datalist id="p-lista-gerente">
                {sugestoes.gerente.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="campo c-6">
              <label htmlFor="p-entidade">Entidade</label>
              <select id="p-entidade" name="entidade" defaultValue="">
                <option value="">Não informada</option>
                <option value="Cooesa Ltda">Cooesa Ltda</option>
                <option value="Cooperativa">Cooperativa</option>
              </select>
            </div>
          </section>

          {/* 2. Objeto técnico */}
          <section hidden={passo !== 1} className="formulario">
            <div className="campo c-12">
              <label htmlFor="p-escopo">Escopo</label>
              <textarea
                id="p-escopo"
                name="escopo"
                rows={2}
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                placeholder="Ex.: Projeto executivo eletromecânico da SE 138 kV"
                aria-invalid={erros.escopo ? true : undefined}
              />
              {erro("escopo")}
              {repetidas.length ? (
                <div className="aviso aviso-alerta pequeno" role="status">
                  Proposta parecida para esta empresa:{" "}
                  {repetidas.map((r, i) => (
                    <span key={r.num}>
                      {i ? "; " : ""}
                      <Link href={`/registros/${r.num}`} target="_blank">
                        Nº {r.num} ({r.ano})
                      </Link>{" "}
                      {r.escopo}
                    </span>
                  ))}
                  . Se for uma nova revisão, informe o número da revisão na próxima etapa.
                </div>
              ) : null}
            </div>
            {(["setor", "area", "empreendimento", "servico", "especialidade"] as const).map((nivel, i) => (
              <div className={`campo ${i < 3 ? "c-4" : "c-6"}`} key={nivel}>
                <label htmlFor={`p-${nivel}`}>
                  {["A — Setor", "B — Área", "C — Empreendimento", "D — Serviço", "E — Especialidade"][i]}
                </label>
                <input
                  id={`p-${nivel}`}
                  name={nivel}
                  type="text"
                  list={`p-lista-${nivel}`}
                  autoComplete="off"
                  {...(nivel === "area"
                    ? { value: area, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setArea(e.target.value) }
                    : {})}
                />
                <datalist id={`p-lista-${nivel}`}>
                  {sugestoes[nivel].map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
            ))}
            <CamposObjetoTecnico erros={erros} area={area} />
          </section>

          {/* 3. Proposta comercial */}
          <section hidden={passo !== 2} className="formulario">
            <div className="campo c-4">
              <label htmlFor="p-data_ini">Data da proposta</label>
              <input id="p-data_ini" name="data_ini" type="date" defaultValue={hoje} />
              {erro("data_ini")}
            </div>
            <div className="campo c-8">
              <label htmlFor="p-situacao">Situação</label>
              <select
                id="p-situacao"
                name="situacao"
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
                aria-invalid={erros.situacao ? true : undefined}
              >
                {SITUACOES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {erro("situacao")}
            </div>
            {situacao === "Contrato encerrado" ? (
              <div className="campo c-4">
                <label htmlFor="p-data_enc">Data de encerramento</label>
                <input id="p-data_enc" name="data_enc" type="date" />
                {erro("data_enc")}
              </div>
            ) : (
              <input type="hidden" name="data_enc" value="" />
            )}
            <div className="campo c-4">
              <span className="rotulo" id="p-rotulo-tipo">
                Tipo
              </span>
              <div role="radiogroup" aria-labelledby="p-rotulo-tipo" className="opcoes-linha">
                <label className="checagem">
                  <input type="radio" name="tipo" value="P" checked={tipo === "P"} onChange={() => setTipo("P")} /> P — total
                </label>
                <label className="checagem">
                  <input type="radio" name="tipo" value="T" checked={tipo === "T"} onChange={() => setTipo("T")} /> T — mensal
                </label>
              </div>
            </div>
            <div className="campo c-8">
              <label htmlFor="p-valor">{tipo === "T" ? "Valor mensal (R$/mês)" : "Valor total da proposta (R$)"}</label>
              <input
                id="p-valor"
                name="valor"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-invalid={erros.valor ? true : undefined}
              />
              {erro("valor")}
              {Number.isFinite(totalEstimado) && totalEstimado > 0 ? (
                <span className="ajuda">
                  Total estimado: {formatarMoeda(totalEstimado)} ({prazo} meses). Só informativo — o tipo T é registrado como
                  valor mensal.
                </span>
              ) : tipo === "T" ? (
                <span className="ajuda">Informe o prazo abaixo para ver o total estimado.</span>
              ) : null}
            </div>
            <div
              onInput={(e) =>
                (e.target as HTMLInputElement).name === "prazo_meses" && setPrazo((e.target as HTMLInputElement).value)
              }
              style={{ display: "contents" }}
            >
              <CamposComerciais erros={erros} />
            </div>
            {perdida ? (
              <>
                <CampoMotivoPerda erros={erros} />
                <div className="campo c-6">
                  <label htmlFor="p-valor_vencedor">Valor do vencedor (R$), se souber</label>
                  <input id="p-valor_vencedor" name="valor_vencedor" type="text" inputMode="decimal" placeholder="0,00" />
                  {erro("valor_vencedor")}
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="motivo_perda" value="" />
                <input type="hidden" name="valor_vencedor" value="" />
              </>
            )}
            <div className="campo c-12">
              <label htmlFor="p-obs">Observações</label>
              <textarea id="p-obs" name="obs" rows={2} />
            </div>
          </section>

          {/* 4. Revisão */}
          <section hidden={passo !== 3}>
            <p className="texto-2">Confira antes de cadastrar. Para corrigir, toque na etapa lá em cima.</p>
            <dl className="definicoes revisao-proposta">
              {revisao.map(([rotulo, v]) => (
                <div
                  key={rotulo}
                  className={
                    rotulo === "Escopo" || rotulo === "Descrição técnica" || rotulo === "Observações" ? "largo" : undefined
                  }
                >
                  <dt>{rotulo}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="assistente-rodape">
          {passo > 0 ? (
            <button type="button" className="btn" onClick={() => irPara(passo - 1)} disabled={pendente}>
              ← Voltar
            </button>
          ) : (
            <Link className="btn btn-texto" href="/cadastrar">
              Cancelar
            </Link>
          )}
          {passo < 3 ? (
            <button type="button" className="btn btn-primario" onClick={() => irPara(passo + 1)}>
              Avançar →
            </button>
          ) : (
            <button type="submit" className="btn btn-primario" disabled={pendente}>
              {pendente ? "Cadastrando…" : "Cadastrar proposta"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
