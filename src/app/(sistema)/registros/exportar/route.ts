import type { NextRequest } from "next/server";
import { carimboArquivo, gerarCSV, gerarXLSX, lerTudo, respostaArquivo, type Coluna } from "@/lib/exportar";
import { aplicarFiltros, COLUNAS_LISTA, COLUNAS_ORDEM, lerFiltros } from "@/lib/registros/filtros";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import type { LinhaRegistroLista } from "@/lib/tipos";

/** Exporta o resultado filtrado (mesmos filtros da URL da lista) em CSV ou Excel. Sem dados de contato (LGPD). */
export async function GET(request: NextRequest) {
  if (!(await obterSessao())) return new Response("Sessão expirada. Entre novamente.", { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const filtros = lerFiltros(params);
  const formato = params.formato === "csv" ? "csv" : "xlsx";
  const supabase = await criarClienteServidor();

  const linhas = await lerTudo<LinhaRegistroLista>((de, ate) =>
    aplicarFiltros(supabase.from("vw_registros").select(COLUNAS_LISTA), filtros)
      .order(COLUNAS_ORDEM[filtros.ordem], { ascending: filtros.dir === "asc", nullsFirst: false })
      .order("num", { ascending: true })
      .range(de, ate),
  );

  const colunas: Coluna<LinhaRegistroLista>[] = [
    { titulo: "Nº", valor: (r) => r.num, tipo: "numero", largura: 7 },
    { titulo: "Ano", valor: (r) => r.ano, tipo: "numero", largura: 7 },
    { titulo: "Cliente", valor: (r) => r.cliente, largura: 28 },
    { titulo: "Grafia original", valor: (r) => r.empresa_original, largura: 18 },
    { titulo: "Escopo", valor: (r) => r.escopo, largura: 60 },
    { titulo: "Situação", valor: (r) => r.situacao, largura: 26 },
    { titulo: "Gerente", valor: (r) => r.gerente, largura: 22 },
    { titulo: "Início", valor: (r) => r.data_ini, tipo: "data", largura: 12 },
    { titulo: "Início (texto original)", valor: (r) => r.data_ini_texto, largura: 14 },
    { titulo: "Encerramento", valor: (r) => r.data_enc, tipo: "data", largura: 12 },
    { titulo: "Encerramento (texto original)", valor: (r) => r.data_enc_texto, largura: 14 },
    { titulo: "Tipo", valor: (r) => r.tipo, largura: 6 },
    {
      titulo: "Valor (P = total, T = mensal)",
      valor: (r) => (r.valor === null ? null : Number(r.valor)),
      tipo: "moeda",
      largura: 18,
    },
    { titulo: "Valor (texto original)", valor: (r) => r.valor_texto, largura: 16 },
    {
      titulo: "Valor vencedor",
      valor: (r) => (r.valor_vencedor === null ? null : Number(r.valor_vencedor)),
      tipo: "moeda",
      largura: 16,
    },
    { titulo: "Entidade", valor: (r) => r.entidade, largura: 13 },
    { titulo: "Setor", valor: (r) => r.setor, largura: 14 },
    { titulo: "Área", valor: (r) => r.area, largura: 14 },
    { titulo: "Empreendimento", valor: (r) => r.empreendimento, largura: 16 },
    { titulo: "Serviço", valor: (r) => r.servico, largura: 18 },
    { titulo: "Especialidade", valor: (r) => r.especialidade, largura: 14 },
    { titulo: "Observações", valor: (r) => r.obs, largura: 30 },
  ];

  const nome = `cooesa-propostas-${carimboArquivo()}`;
  if (formato === "csv") return respostaArquivo(gerarCSV(colunas, linhas), `${nome}.csv`, "csv");
  const xlsx = await gerarXLSX([
    {
      nome: "Propostas e contratos",
      colunas,
      linhas,
      titulo: "Cooesa Engenharia — Propostas e contratos",
      subtitulo: `Exportado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${linhas.length} registros · Tipo T = valor mensal`,
    },
  ]);
  return respostaArquivo(xlsx, `${nome}.xlsx`, "xlsx");
}
