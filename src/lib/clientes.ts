import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Localiza o cliente pelo nome exato (já normalizado em maiúsculas) ou cria um
 * novo. Editores podem criar clientes; unificar grafias é tarefa do admin.
 */
export async function obterOuCriarCliente(
  supabase: SupabaseClient,
  nome: string,
): Promise<{ id: number; criado: boolean } | { erro: string }> {
  const existente = await supabase.from("clientes").select("id").eq("nome", nome).maybeSingle();
  if (existente.data) return { id: existente.data.id as number, criado: false };

  const novo = await supabase.from("clientes").insert({ nome }).select("id").single();
  if (novo.data) return { id: novo.data.id as number, criado: true };

  // outro usuário pode ter criado o mesmo nome ao mesmo tempo
  if (novo.error?.code === "23505") {
    const denovo = await supabase.from("clientes").select("id").eq("nome", nome).maybeSingle();
    if (denovo.data) return { id: denovo.data.id as number, criado: false };
  }
  return { erro: "Não foi possível cadastrar o cliente. Verifique se você tem papel de editor." };
}

/** Lista de nomes de clientes (para autocompletar). */
export async function nomesClientes(supabase: SupabaseClient): Promise<{ id: number; nome: string }[]> {
  const todos: { id: number; nome: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase.from("clientes").select("id, nome").order("nome").range(de, de + 999);
    const lote = (data ?? []) as { id: number; nome: string }[];
    todos.push(...lote);
    if (lote.length < 1000) break;
  }
  return todos;
}
