import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/exportar";

export type Sugestoes = Record<"setor" | "area" | "empreendimento" | "servico" | "especialidade" | "gerente", string[]>;

/** Separa listas da árvore de pesquisa ("Inventário, Viabilidade, Básico.") em itens. */
function itensTaxonomia(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(",")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

/**
 * Valores já usados em cada nível da classificação (mais usados primeiro),
 * completados pelos itens da árvore de pesquisa. Serve para o autocompletar
 * evitar novas grafias do mesmo termo.
 */
export async function carregarSugestoes(supabase: SupabaseClient): Promise<Sugestoes> {
  const [usados, taxonomia] = await Promise.all([
    lerTudo<{ nivel: keyof Sugestoes; valor: string; usos: number }>((de, ate) =>
      supabase.from("vw_valores_classificacao").select("nivel, valor, usos").order("usos", { ascending: false }).range(de, ate),
    ),
    lerTudo<{ setor: string; area: string | null; empreendimentos: string | null; servicos: string | null; especialidades: string | null }>(
      (de, ate) => supabase.from("taxonomia").select("setor, area, empreendimentos, servicos, especialidades").order("ordem").range(de, ate),
    ),
  ]);

  const s: Sugestoes = { setor: [], area: [], empreendimento: [], servico: [], especialidade: [], gerente: [] };
  for (const u of usados) s[u.nivel]?.push(u.valor);

  const acrescentar = (nivel: keyof Sugestoes, valores: string[]) => {
    const vistos = new Set(s[nivel].map((v) => v.toLocaleLowerCase("pt-BR")));
    for (const v of valores) {
      if (!vistos.has(v.toLocaleLowerCase("pt-BR"))) {
        s[nivel].push(v);
        vistos.add(v.toLocaleLowerCase("pt-BR"));
      }
    }
  };
  for (const t of taxonomia) {
    acrescentar("setor", [t.setor]);
    if (t.area) acrescentar("area", [t.area]);
    acrescentar("empreendimento", itensTaxonomia(t.empreendimentos));
    acrescentar("servico", itensTaxonomia(t.servicos));
    acrescentar("especialidade", itensTaxonomia(t.especialidades));
  }
  return s;
}
