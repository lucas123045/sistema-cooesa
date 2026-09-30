/**
 * Carga inicial do banco a partir de data/cooesa_dados.json.
 *
 *   npm run seed        (usa .env.local: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
 *
 * - Toda a carga roda numa única transação no banco (função importar_planilha).
 * - Idempotente: rodar de novo não duplica nem sobrescreve nada.
 * - No fim, confere cada número da seção 4.6 e termina com erro se algum divergir.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { conferirCarga, formatarConferencia, type DadosConferencia } from "../src/lib/conferencia-carga";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  const caminho = join(__dirname, "..", "data", "cooesa_dados.json");
  const dados = JSON.parse(readFileSync(caminho, "utf8"));
  console.log(`Lido ${caminho}: ${dados.registros.length} registros, ${dados.notas.length} notas.`);

  const { data: inseridos, error } = await supabase.rpc("importar_planilha", { dados });
  if (error) {
    console.error("A importação falhou (nada foi gravado — a transação foi desfeita):", error.message);
    process.exit(1);
  }
  console.log("Inseridos nesta execução (0 = já existiam):", inseridos);

  const conferencia = await lerConferencia(supabase);
  const itens = conferirCarga(conferencia);
  console.log("\n" + formatarConferencia(itens) + "\n");
  const divergentes = itens.filter((i) => !i.ok);
  if (divergentes.length) {
    console.error(`${divergentes.length} número(s) DIVERGENTE(S). A carga não está correta.`);
    process.exit(1);
  }
  console.log("Todos os números da seção 4.6 conferem.");
}

async function lerConferencia(supabase: SupabaseClient): Promise<DadosConferencia> {
  const [resumo, situacoes, anual, acomp] = await Promise.all([
    supabase.from("vw_resumo").select("*").single(),
    supabase.from("vw_contagem_situacoes").select("situacao, quantidade"),
    supabase.from("vw_faturamento_anual").select("ano, quantidade, total"),
    supabase.from("vw_contagem_acompanhamentos").select("*").single(),
  ]);
  for (const r of [resumo, situacoes, anual, acomp]) {
    if (r.error) throw new Error(`Falha ao consultar as views: ${r.error.message}`);
  }
  return {
    resumo: resumo.data as DadosConferencia["resumo"],
    situacoes: situacoes.data as DadosConferencia["situacoes"],
    faturamentoAnual: anual.data as DadosConferencia["faturamentoAnual"],
    acompanhamentos: acomp.data as DadosConferencia["acompanhamentos"],
  };
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
