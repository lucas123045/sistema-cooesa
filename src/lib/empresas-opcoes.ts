import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/consultas";

/** Dados de apoio do formulário de empresa: empresas existentes (aviso de duplicata) e sugestões. */
export async function opcoesFormEmpresa(db: SupabaseClient) {
  const [existentes, taxonomia, gerentes] = await Promise.all([
    lerTudo<{ id: number; nome: string; cnpj: string | null; setor: string | null; responsavel: string | null }>((a, b) =>
      db.from("clientes").select("id, nome, cnpj, setor, responsavel").order("nome").range(a, b),
    ),
    lerTudo<{ setor: string }>((a, b) => db.from("taxonomia").select("setor").range(a, b)),
    lerTudo<{ valor: string }>((a, b) =>
      db.from("vw_valores_classificacao").select("valor").eq("nivel", "gerente").order("usos", { ascending: false }).range(a, b),
    ),
  ]);
  const unicos = (lista: (string | null)[]) =>
    [...new Set(lista.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    existentes: existentes.map(({ id, nome, cnpj }) => ({ id, nome, cnpj })),
    setores: unicos([...taxonomia.map((t) => t.setor), ...existentes.map((e) => e.setor)]),
    responsaveis: unicos([...existentes.map((e) => e.responsavel), ...gerentes.map((g) => g.valor)]),
  };
}
