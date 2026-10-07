import type { NextRequest } from "next/server";
import { formatarCnpj } from "@/lib/empresas";
import { aplicarFiltrosEmpresas, COLUNAS_EMPRESA, lerFiltrosEmpresas } from "@/lib/empresas-filtros";
import { carimboArquivo, gerarCSV, gerarXLSX, lerTudo, respostaArquivo, type Coluna } from "@/lib/exportar";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import type { LinhaCliente } from "@/lib/tipos";

/** Exporta a lista filtrada de empresas. Sem contatos (LGPD). */
export async function GET(request: NextRequest) {
  if (!(await obterSessao())) return new Response("Sessão expirada. Entre novamente.", { status: 401 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const f = lerFiltrosEmpresas(params);
  const db = await criarClienteServidor();

  const linhas = await lerTudo<LinhaCliente>((de, ate) =>
    aplicarFiltrosEmpresas(db.from("vw_clientes").select("*"), f)
      .order(COLUNAS_EMPRESA[f.ordem], { ascending: f.dir === "asc", nullsFirst: false })
      .order("nome")
      .range(de, ate),
  );

  const n = (v: number | string | null) => (v === null ? null : Number(v));
  const colunas: Coluna<LinhaCliente>[] = [
    { titulo: "Empresa", valor: (c) => c.nome, largura: 26 },
    { titulo: "Razão social", valor: (c) => c.razao_social, largura: 36 },
    { titulo: "CNPJ", valor: (c) => (c.cnpj ? formatarCnpj(c.cnpj) : null), largura: 20 },
    { titulo: "Status", valor: (c) => c.status, largura: 20 },
    { titulo: "Setor", valor: (c) => c.setor, largura: 14 },
    { titulo: "Cidade", valor: (c) => c.cidade, largura: 18 },
    { titulo: "UF", valor: (c) => c.uf, largura: 5 },
    { titulo: "Responsável", valor: (c) => c.responsavel, largura: 20 },
    { titulo: "Origem", valor: (c) => c.origem, largura: 16 },
    { titulo: "Propostas", valor: (c) => c.propostas, tipo: "numero", largura: 10 },
    { titulo: "Contratos", valor: (c) => c.contratos, tipo: "numero", largura: 10 },
    { titulo: "Proposto (P)", valor: (c) => n(c.valor_proposto_p), tipo: "moeda", largura: 16 },
    { titulo: "Contratado (P)", valor: (c) => n(c.valor_contratado_p), tipo: "moeda", largura: 16 },
    { titulo: "Contratado (T, mensal)", valor: (c) => n(c.valor_contratado_t), tipo: "moeda", largura: 16 },
    { titulo: "Faturado", valor: (c) => n(c.faturado), tipo: "moeda", largura: 16 },
    { titulo: "Última proposta", valor: (c) => c.ultima_proposta, tipo: "data", largura: 14 },
  ];

  const nome = `cooesa-empresas-${carimboArquivo()}`;
  if (params.formato === "csv") return respostaArquivo(gerarCSV(colunas, linhas), `${nome}.csv`, "csv");
  const xlsx = await gerarXLSX([
    {
      nome: "Empresas",
      colunas,
      linhas,
      titulo: "Cooesa Engenharia — Empresas",
      subtitulo: `${linhas.length} empresas · sem dados de contato · T = valor mensal`,
    },
  ]);
  return respostaArquivo(xlsx, `${nome}.xlsx`, "xlsx");
}
