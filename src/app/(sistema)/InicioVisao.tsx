import Link from "next/link";
import { Icone, type NomeIcone } from "@/components/Icone";
import { AbertosRecentemente } from "@/components/recentes";
import { capitalizar, formatarData, formatarInteiro, formatarMoeda, formatarMoedaCompacta, formatarPercentual, rotuloUsuario } from "@/lib/formato";
import { eAdmin, podeEditar, type Papel } from "@/lib/papeis";
import type { Resumo } from "@/lib/tipos";

export type Alteracao = { id: number; tabela: string; chave: string; acao: "insert" | "update" | "delete"; usuario: string; quando: string };

export type DadosInicio = {
  nome: string;
  papel: Papel;
  r: Resumo | null;
  qtdPendencias: number;
  qtdClientes: number;
  semCredito: { valor: number | string }[];
  fat: { ano: number; total: number | string; quantidade: number } | undefined;
  listaAlteracoes: Alteracao[];
  clienteDoRegistro: Map<number, string>;
  notaPorId: Map<number, string>;
  aguardando: { num: number; cliente: string }[];
  agora: Date;
};

const FUSO = "America/Sao_Paulo";

function saudacao(agora: Date): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: FUSO }).format(agora));
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

/** "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
function quandoRelativo(iso: string, agora: Date): string {
  const minutos = Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return formatarData(iso.slice(0, 10));
}

const ROTULO_ACAO = { insert: "criou", update: "alterou", delete: "excluiu" } as const;

/** Parte visual do Início (sem acesso ao banco). */
export function InicioVisao({ nome, papel, r, qtdPendencias, qtdClientes, semCredito, fat, listaAlteracoes, clienteDoRegistro, notaPorId, aguardando, agora }: DadosInicio) {
  const valorSemCredito = semCredito.reduce((s, n) => s + Number(n.valor), 0);
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO }).format(agora);
  const primeiroNome = nome.split(" ")[0];
  const editor = podeEditar(papel);

  const atalhos: { href: string; icone: NomeIcone; titulo: string; valor: string; detalhe: string; alerta?: boolean }[] = [
    {
      href: "/painel",
      icone: "painel",
      titulo: "Painel executivo",
      valor: r ? `${formatarInteiro(r.contratos_totais)} contratos` : "—",
      detalhe: r ? `${formatarPercentual(Number(r.pct_sucesso))} de sucesso desde ${r.primeiro_ano}` : "Linha do tempo da empresa",
    },
    { href: "/resultados", icone: "resultados", titulo: "Resultados", valor: "Áreas e clientes", detalhe: "Sucesso por valor, ticket e concentração" },
    {
      href: "/curriculo",
      icone: "curriculo",
      titulo: "Currículo",
      valor: r ? `${formatarInteiro(r.encerrados)} encerrados` : "—",
      detalhe: "Experiência para licitações",
    },
    {
      href: "/faturamento",
      icone: "faturamento",
      titulo: "Faturamento",
      valor: fat ? formatarMoedaCompacta(Number(fat.total)) : "—",
      detalhe: fat ? `${fat.quantidade} notas em ${fat.ano} (último ano registrado)` : "Nenhuma nota",
    },
    {
      href: "/clientes",
      icone: "clientes",
      titulo: "Clientes",
      valor: formatarInteiro(qtdClientes),
      detalhe: r ? `${formatarInteiro(r.clientes_contrataram)} já contrataram` : "Histórico por cliente",
    },
    {
      href: "/pendencias",
      icone: "pendencias",
      titulo: "Pendências de dados",
      valor: qtdPendencias ? `${qtdPendencias} a revisar` : "Em dia",
      detalhe: "Legado da planilha",
      alerta: qtdPendencias > 0,
    },
    ...(eAdmin(papel)
      ? [{ href: "/configuracoes", icone: "configuracoes" as const, titulo: "Configurações", valor: "Admin", detalhe: "Usuários, alíquotas e backup" }]
      : []),
  ];

  return (
    <div className="inicio">
      <header className="inicio-topo">
        <div>
          <p className="inicio-data">{capitalizar(hoje)}</p>
          <h1>
            {saudacao(agora)}, {primeiroNome}
          </h1>
        </div>
        <form action="/buscar" className="inicio-busca" role="search">
          <label htmlFor="busca-inicio" className="sr-only">
            Buscar proposta, cliente ou Nº
          </label>
          <Icone nome="buscar" className="inicio-busca-icone" />
          <input id="busca-inicio" name="q" type="search" placeholder="Nº, cliente ou escopo…" autoComplete="off" enterKeyHint="search" />
          <button className="btn btn-primario" type="submit">
            Buscar
          </button>
        </form>
      </header>

      {editor ? (
        <nav className="inicio-acoes" aria-label="Ações rápidas">
          <Link className="btn" href="/registros/novo">
            <Icone nome="mais" tamanho={16} /> Nova proposta
          </Link>
          <Link className="btn" href="/faturamento/notas/nova">
            <Icone nome="mais" tamanho={16} /> Nova nota fiscal
          </Link>
          <Link className="btn" href="/registros?atalho=aguardando">
            <Icone nome="relogio" tamanho={16} /> Aguardando resposta
          </Link>
        </nav>
      ) : null}

      <Link href="/registros" className="inicio-destaque">
        <span className="inicio-destaque-icone">
          <Icone nome="propostas" tamanho={26} />
        </span>
        <span className="inicio-destaque-texto">
          <strong>Propostas e contratos</strong>
          <span>
            {r
              ? `${formatarInteiro(r.total_propostas)} registros · ${r.aguardando} aguardando resposta · ${r.em_andamento} contratos em andamento`
              : "Todo o acervo comercial desde 2000"}
          </span>
        </span>
        <Icone nome="seta" tamanho={22} className="inicio-destaque-seta" />
      </Link>

      <nav className="inicio-atalhos" aria-label="Áreas do sistema">
        {atalhos.map((a) => (
          <Link key={a.href} href={a.href} className={`atalho-cartao${a.alerta ? " alerta" : ""}`}>
            <Icone nome={a.icone} tamanho={22} className="atalho-cartao-icone" />
            <span className="atalho-cartao-titulo">{a.titulo}</span>
            <span className="atalho-cartao-valor">{a.valor}</span>
            <span className="atalho-cartao-detalhe">{a.detalhe}</span>
          </Link>
        ))}
      </nav>

      <div className="grade grade-3 inicio-listas">
        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Precisa de atenção</h2>
          </div>
          <ul className="lista-painel">
            <li>
              <div>
                <Link href="/registros?atalho=aguardando">
                  <strong>{r?.aguardando ?? 0} propostas aguardando resposta</strong>
                </Link>
                <span className="sub">
                  {aguardando.map((a) => `Nº ${a.num} ${a.cliente}`).join(" · ") || "Nenhuma no momento"}
                </span>
              </div>
            </li>
            <li>
              <div>
                <Link href="/faturamento">
                  <strong>{semCredito.length} notas emitidas sem crédito registrado</strong>
                </Link>
                <span className="sub">{formatarMoeda(valorSemCredito)} · confirme com o financeiro</span>
              </div>
            </li>
            <li>
              <div>
                <Link href="/pendencias">
                  <strong>{qtdPendencias} pendências de dados</strong>
                </Link>
                <span className="sub">Datas, valores e clientes da planilha para revisar</span>
              </div>
            </li>
            {r && r.em_litigio ? (
              <li>
                <div>
                  <Link href="/registros?atalho=litigio">
                    <strong>{r.em_litigio} registros em litígio</strong>
                  </Link>
                </div>
              </li>
            ) : null}
          </ul>
        </section>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Abertos recentemente</h2>
            <span className="nota">neste aparelho</span>
          </div>
          <AbertosRecentemente />
        </section>

        <section className="painel">
          <div className="painel-cabecalho">
            <h2>Alterações recentes</h2>
          </div>
          {listaAlteracoes.length ? (
            <ul className="lista-painel">
              {listaAlteracoes.map((a) => {
                const registro = a.tabela === "registros";
                const href = registro ? `/registros/${a.chave}` : a.tabela === "clientes" ? `/clientes/${a.chave}` : a.tabela === "notas_fiscais" ? `/faturamento/notas/${a.chave}/editar` : null;
                const alvo = registro
                  ? `Nº ${a.chave}${clienteDoRegistro.get(Number(a.chave)) ? ` · ${clienteDoRegistro.get(Number(a.chave))}` : ""}`
                  : a.tabela === "notas_fiscais"
                    ? (notaPorId.get(Number(a.chave)) ?? "uma nota fiscal")
                    : a.tabela === "clientes"
                      ? "um cliente"
                      : "um acompanhamento";
                return (
                  <li key={a.id}>
                    <div>
                      {href && a.acao !== "delete" ? <Link href={href}>{alvo}</Link> : <span>{alvo}</span>}
                      <span className="sub">
                        {rotuloUsuario(a.usuario)} {ROTULO_ACAO[a.acao]} · {quandoRelativo(a.quando, agora)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="vazio pequeno">Nenhuma alteração feita no sistema ainda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
