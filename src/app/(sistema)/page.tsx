import type { Metadata } from "next";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import type { Resumo } from "@/lib/tipos";
import { InicioVisao, type Alteracao } from "./InicioVisao";

export const metadata: Metadata = { title: "Início" };

export default async function Inicio() {
  const sessao = await exigirSessao();
  const db = await criarClienteServidor();
  const [resumo, pendencias, clientes, notasSemCredito, ultimoFaturamento, alteracoes, aguardando] = await Promise.all([
    db.from("vw_resumo").select("*").maybeSingle(),
    db.from("vw_pendencias").select("*", { count: "exact", head: true }),
    db.from("clientes").select("*", { count: "exact", head: true }),
    db.from("notas_fiscais").select("valor").is("data_credito", null).not("data_emissao", "is", null),
    db.from("vw_faturamento_anual").select("ano, total, quantidade").order("ano", { ascending: false }).limit(1),
    db
      .from("historico_alteracoes")
      .select("id, tabela, chave, acao, usuario, quando")
      .in("tabela", ["registros", "notas_fiscais", "acompanhamentos", "clientes"])
      .neq("usuario", "importação da planilha")
      .order("quando", { ascending: false })
      .limit(6),
    db.from("vw_registros").select("num, cliente, ano").eq("situacao", "Proposta colocada").order("num", { ascending: false }).limit(3),
  ]);

  const r = resumo.data as Resumo | null;
  const qtdPendencias = pendencias.count ?? 0;
  const semCredito = notasSemCredito.data ?? [];
  const fat = ultimoFaturamento.data?.[0] as { ano: number; total: number | string; quantidade: number } | undefined;
  const listaAlteracoes = (alteracoes.data ?? []) as Alteracao[];

  // Nome do cliente para as alterações em registros.
  const numsAlterados = [...new Set(listaAlteracoes.filter((a) => a.tabela === "registros").map((a) => Number(a.chave)))];
  const { data: nomes } = numsAlterados.length
    ? await db.from("vw_registros").select("num, cliente").in("num", numsAlterados)
    : { data: [] as { num: number; cliente: string }[] };
  const clienteDoRegistro = new Map((nomes ?? []).map((n) => [n.num as number, n.cliente as string]));

  // Número e cliente das notas citadas nas alterações.
  const idsNotas = [...new Set(listaAlteracoes.filter((a) => a.tabela === "notas_fiscais").map((a) => Number(a.chave)))];
  const { data: notas } = idsNotas.length
    ? await db.from("vw_notas").select("id, numero, cliente_exibicao").in("id", idsNotas)
    : { data: [] as { id: number; numero: string | null; cliente_exibicao: string | null }[] };
  const notaPorId = new Map(
    (notas ?? []).map((n) => [n.id as number, `NF ${(n.numero as string | null) || "s/nº"}${n.cliente_exibicao ? ` · ${n.cliente_exibicao}` : ""}`]),
  );

  return (
    <InicioVisao
      nome={sessao.nome}
      papel={sessao.papel}
      r={r}
      qtdPendencias={qtdPendencias}
      qtdClientes={clientes.count ?? 0}
      semCredito={semCredito}
      fat={fat}
      listaAlteracoes={listaAlteracoes}
      clienteDoRegistro={clienteDoRegistro}
      notaPorId={notaPorId}
      aguardando={(aguardando.data ?? []) as { num: number; cliente: string }[]}
      agora={new Date()}
    />
  );
}
