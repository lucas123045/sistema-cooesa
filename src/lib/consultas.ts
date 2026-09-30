import "server-only";

/** Lê todas as linhas de uma consulta paginando de 1.000 em 1.000 (limite da API do Supabase). */
export async function lerTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tamanho = 1000;
  const todas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    todas.push(...lote);
    if (lote.length < tamanho) break;
  }
  return todas;
}
