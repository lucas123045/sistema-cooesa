import type { NextRequest } from "next/server";
import { carimboArquivo, gerarXLSX, lerTudo, respostaArquivo, type Coluna } from "@/lib/exportar";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import type { NotaFiscal } from "@/lib/tipos";

/** Exporta as notas fiscais de um ano em Excel. */
export async function GET(request: NextRequest) {
  if (!(await obterSessao())) return new Response("Sessão expirada. Entre novamente.", { status: 401 });

  const ano = Number(request.nextUrl.searchParams.get("ano"));
  if (!Number.isInteger(ano) || ano < 1990 || ano > 2100) return new Response("Ano inválido.", { status: 400 });

  const db = await criarClienteServidor();
  const notas = await lerTudo<NotaFiscal>((de, ate) =>
    db.from("vw_notas").select("*").eq("ano", ano).order("data_emissao").range(de, ate),
  );

  const colunas: Coluna<NotaFiscal>[] = [
    { titulo: "NF", valor: (n) => n.numero, largura: 10 },
    { titulo: "Emissão", valor: (n) => n.data_emissao, tipo: "data", largura: 12 },
    { titulo: "Crédito", valor: (n) => n.data_credito, tipo: "data", largura: 12 },
    { titulo: "Cliente", valor: (n) => n.cliente_exibicao ?? n.empresa_texto, largura: 28 },
    { titulo: "Título", valor: (n) => n.titulo, largura: 60 },
    { titulo: "Valor", valor: (n) => Number(n.valor), tipo: "moeda", largura: 16 },
    { titulo: "Registro", valor: (n) => n.registro_num, tipo: "numero", largura: 10 },
    { titulo: "Origem (aba)", valor: (n) => n.origem_aba, largura: 20 },
    { titulo: "Origem (linha)", valor: (n) => n.origem_linha, tipo: "numero", largura: 10 },
  ];

  const arquivo = await gerarXLSX([
    { nome: `Notas ${ano}`, titulo: `Cooesa Engenharia — Faturamento ${ano}`, subtitulo: `${notas.length} notas fiscais`, colunas, linhas: notas },
  ]);
  return respostaArquivo(arquivo, `cooesa-faturamento-${ano}-${carimboArquivo()}.xlsx`, "xlsx");
}
