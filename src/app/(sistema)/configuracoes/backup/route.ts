import type { NextRequest } from "next/server";
import { lerTudo } from "@/lib/consultas";
import { carimboArquivo, gerarXLSX, respostaArquivo, type Coluna } from "@/lib/exportar";
import { eAdmin } from "@/lib/papeis";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

/** Tabelas do backup e a coluna usada para ordenar (a leitura é paginada). */
const TABELAS: [string, string][] = [
  ["clientes", "id"],
  ["registros", "num"],
  ["acompanhamentos", "id"],
  ["notas_fiscais", "id"],
  ["taxonomia", "id"],
  ["configuracoes", "chave"],
  ["perfis", "user_id"],
  ["pendencias_revisadas", "tipo"],
  ["avisos_importacao", "id"],
  ["historico_alteracoes", "id"],
];

type Linha = Record<string, unknown>;

/**
 * Backup manual (só admin): todas as tabelas, em JSON ou Excel (uma aba por tabela).
 * Lê com a sessão do admin — o RLS permite ao admin ler tudo; a service_role não é usada.
 * Contém dados pessoais (contatos): guarde o arquivo em local restrito.
 */
export async function GET(request: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao || !eAdmin(sessao.papel)) return new Response("Apenas administradores podem gerar backup.", { status: 403 });

  const formato = request.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "json";
  const db = await criarClienteServidor();

  const tabelas: Record<string, Linha[]> = {};
  for (const [tabela, ordem] of TABELAS) {
    tabelas[tabela] = await lerTudo<Linha>((de, ate) => db.from(tabela).select("*").order(ordem).range(de, ate));
  }
  const nome = `cooesa-backup-${carimboArquivo()}`;

  if (formato === "json") {
    const conteudo = {
      gerado_em: new Date().toISOString(),
      gerado_por: sessao.email,
      contagem: Object.fromEntries(Object.entries(tabelas).map(([t, l]) => [t, l.length])),
      tabelas,
    };
    return respostaArquivo(JSON.stringify(conteudo, null, 1), `${nome}.json`, "json");
  }

  const planilhas = Object.entries(tabelas).map(([tabela, linhas]) => {
    const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter((c) => c !== "busca");
    const colunas: Coluna<Linha>[] = chaves.map((c) => ({
      titulo: c,
      valor: (l) => {
        const v = l[c];
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return JSON.stringify(v); // jsonb (histórico, configurações)
        if (typeof v === "boolean") return v ? "sim" : "não";
        return v as string | number;
      },
      largura: c === "antes" || c === "depois" || c === "escopo" ? 60 : 16,
    }));
    return { nome: tabela, colunas, linhas };
  });
  return respostaArquivo(await gerarXLSX(planilhas), `${nome}.xlsx`, "xlsx");
}
