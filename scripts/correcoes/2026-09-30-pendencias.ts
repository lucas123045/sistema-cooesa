/**
 * Correção de pendências de dados — 30/09/2026, autorizada por Lucas.
 *
 *   npx tsx --env-file=.env.local scripts/correcoes/2026-09-30-pendencias.ts            (simulação)
 *   npx tsx --env-file=.env.local scripts/correcoes/2026-09-30-pendencias.ts --aplicar  (grava)
 *
 * Só corrige o que os próprios dados sustentam (evidência anotada em cada item e em
 * docs/correcoes-2026-09-30.md). Textos originais da planilha continuam preservados
 * (data_ini_texto, valor_texto, empresa_texto, empresa_original) e toda alteração
 * entra no historico_alteracoes pelos triggers. Idempotente: só mexe no que ainda está pendente.
 */
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");
const MOTIVO = "Correção de 30/09/2026 autorizada por Lucas; evidências em docs/correcoes-2026-09-30.md";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// 1. Datas de início ilegíveis: a única leitura que cai entre as datas dos registros vizinhos
//    (a numeração da planilha é cronológica). 407 (12 ou 15/04) e 803 (31/04 não existe) ficam para revisão humana.
const DATAS_INICIO: [number, string, string][] = [
  [440, "2006-10-02", "“002.10.06”: zero a mais; vizinhos 439 = 26/09/2006 e 441 = 17/10/2006"],
  [519, "2008-01-21", "“211.01.08”: vizinhos 518 = 15/01 e 520 = 21/01/2008 (11/01 ficaria antes do 518)"],
  [563, "2008-09-09", "“09.09.8”: vizinhos 562 = 08/09 e 564 = 11/09/2008"],
  [577, "2009-03-19", "“19.103.09”: vizinhos 576 = 06/03 e 578 = 23/03/2009 (19/10 não cabe)"],
  [685, "2011-06-22", "“22+..11”: dia 22; vizinhos 684 = 21/06 e 686 = 27/06/2011 — só junho cabe"],
  [726, "2013-01-18", "“18.01.+13”: vizinhos 725 = 17/12/2012 e 727 = 29/01/2013"],
  [777, "2015-05-15", "“15.05.156”: vizinhos 776 = 09/04 e 778 = 08/06/2015"],
];

// 2. Encerramentos mês/ano com abreviação inequívoca: confirma a data inferida (dia 1º, convenção da extração).
//    864 (“jin/20”: jun ou jan) e 908 (“ju/20”: jun ou jul) ficam para revisão humana.
const ENCERRAMENTOS_CONFIRMADOS = [59, 77, 158, 173, 222, 306, 308, 324, 373, 385, 393, 398, 459, 722, 723, 895];

// 3. Valores em texto sem um valor numérico único: confirma que ficam sem valor (o texto segue preservado).
//    61 (“19.600,00/mês”), 838 (“15 milhões”) e 839 (“23,7 milhões”) ficam para decisão do dono:
//    preenchê-los muda os totais históricos e os dois últimos são orçamentos de leilão.
const VALORES_SEM_NUMERO: [number, string][] = [
  [650, "“-”"], [748, "“-”"], [851, "“-”"], [899, "“-”"], [900, "“-”"], [914, "“-”"],
  [755, "“VARIÁVEL”"], [970, "“Cancelada” escrito na coluna de valor"],
  [221, "valores por hora (Hh)"], [231, "valores por hora (Hh)"], [247, "valores por hora (Hh)"],
  [291, "percentual da produção (25%)"],
];

// 4. Nomes unificados na extração (erros de digitação evidentes) e divergências de total da planilha:
//    confirmados — o sistema sempre soma as notas, nunca totais digitados.
const UNIFICACOES_CONFIRMADAS = ["218", "650", "727", "898", "970"];
const DIVERGENCIAS_CONFERIDAS = ["2020-10", "2024-07"];

// 5. Clientes: unificar quando o mesmo contato pede o mesmo tipo de serviço (origem → destino, fica o nome completo).
const UNIFICAR: [string, string, string][] = [
  ["ENERGI", "ENERGISA", "mesmo contato (Juraci), mesmas obras Elektro em 2013"],
  ["DH", "DHIDROVIÁRIO", "mesmo contato (Sampaio), mesma fiscalização de eclusas"],
  ["VIVAN", "VIVAN ENGENHARIA", "mesmo contato (Milton Vivan), projetos geotécnicos/barragens"],
];
// Pares com nomes parecidos mas empresas diferentes (contatos, áreas e épocas distintas).
const CLIENTES_DIFERENTES: [string, string][] = [
  ["GE", "GEOCOMPANY"], ["GE", "GEVISA"], ["GE", "GEOTEL"], ["GE", "GEOLT"], ["GE", "GENPRO"],
  ["COP", "COPRO"], ["STE", "STERLITE / THREE AR"], ["TEM", "TEMAT"], ["MAP", "MAPAL"],
  ["CPFL", "CPFL RENOVÁVEIS"], ["CPFL", "CPFL JAGUARIÚNA"],
];

// 6. Acompanhamentos antigos: vínculo por escopo idêntico/equivalente ou valor a receber igual ao já vinculado.
//    #71 (NOVA I: registro 122 ou 222) e #80 (escopo diferente do candidato) ficam para revisão humana.
const ACOMPANHAMENTOS: [number, number, string][] = [
  [69, 137, "CTHI/CTIH (letras trocadas), licenciamento ambiental em Indaiatuba"],
  [70, 137, "CTHI/CTIH (letras trocadas), licenciamento ambiental em Indaiatuba"],
  [72, 256, "AES Tietê, leituristas; mesmo valor a receber (R$ 13.866) já vinculado ao 256 em 2004"],
  [73, 175, "Sistema PRI/CDHU R$/mês; mesmo valor a receber (R$ 2.514) já vinculado ao 175 em 2004"],
  [77, 175, "Sistema PRI/CDHU R$/mês; mesmo valor a receber (R$ 2.514) já vinculado ao 175 em 2004"],
  [74, 334, "Produquímica, avaliação da PCH Cunha"],
  [75, 348, "Eletropaulo, desenhos físico-dimensionais em AutoCAD"],
  [78, 348, "Eletropaulo, desenhos físico-dimensionais em AutoCAD"],
  [76, 367, "Termoconsult, estudo de turbina a gás; a receber = valor do contrato (R$ 4.320)"],
  [79, 397, "Eletropaulo, “Serviços Extras de Projeto Loja Santana” (escopo idêntico)"],
];

// 7. Notas com empresa não cadastrada: cliente pelo título da NF (e registro quando a série já estava vinculada na planilha).
//    Engekraft Radani (2 notas, “SE Bandeirantes”) e as 7 notas sem empresa/data ficam para revisão humana.
const NOTAS: { id: number; cliente: string; registro?: number; evidencia: string }[] = [
  ...[102, 103, 104, 105, 106].map((id) => ({ id, cliente: "TSEA / THREE AR", registro: 925, evidencia: "série “BMS - Itamaracá - Lote 11”; a BMS 01 (nota 108) já estava ligada ao 925 na planilha" })),
  ...[110, 112].map((id) => ({ id, cliente: "TSEA / THREE AR", registro: 896, evidencia: "série “Básico Jandaíra”; a BMS 03 (nota 107) já estava ligada ao 896 na planilha" })),
  { id: 113, cliente: "TSEA / THREE AR", registro: 873, evidencia: "“LT Itamaracá”; a BMS 03 - LT Itamaracá (nota 109) já estava ligada ao 873" },
  ...[107, 108, 109, 111].map((id) => ({ id, cliente: "TSEA / THREE AR", evidencia: "título “COOESA-TSEA”; único cliente TSEA cadastrado" })),
  ...[114, 115, 116].map((id) => ({ id, cliente: "BRZ EXPERTS", evidencia: "título “BRZ-Cooesa”; único cliente BRZ cadastrado" })),
  { id: 117, cliente: "ZX", registro: 938, evidencia: "“2ª Parcela Projetos Básicos” = registro 938 (Projetos Básicos das CGH, ZX)" },
  { id: 119, cliente: "ZX", registro: 938, evidencia: "“UP-ZX 3ª Parcela Projetos Básicos” = continuação da nota 117" },
  { id: 118, cliente: "ZX", registro: 907, evidencia: "“Hidrológicos MS QL” = registro 907 (hidrologia Monte Serrat/Quilombo, ZX)" },
  { id: 120, cliente: "GE / THREE AR", registro: 880, evidencia: "“Suportes Padre Paraíso e João Neiva” = escopo do registro 880" },
  { id: 121, cliente: "PCH SAL", registro: 969, evidencia: "“PCH do Sal - Estudos Pré” = registro 969 (Pré-viabilidade)" },
];

let alteracoes = 0;
async function executar(descricao: string, fn: () => PromiseLike<{ error: { message: string } | null; count?: number | null }>) {
  if (!APLICAR) {
    console.log(`[simulação] ${descricao}`);
    return;
  }
  const r = await fn();
  if (r.error) throw new Error(`${descricao}: ${r.error.message}`);
  alteracoes++;
  console.log(`[ok] ${descricao}${r.count !== undefined && r.count !== null ? ` (${r.count} linha(s))` : ""}`);
}

async function main() {
  const { data: perfis } = await db.from("perfis").select("user_id, nome");
  const autor = perfis?.[0]?.user_id ?? null; // quem autorizou (único usuário no momento)
  const idCliente = async (nome: string) => (await db.from("clientes").select("id").eq("nome", nome).maybeSingle()).data?.id as number | undefined;
  const revisar = (tipo: string, chave: string, obs: string) =>
    executar(`revisada ${tipo} ${chave}`, () =>
      db.from("pendencias_revisadas").upsert(
        { tipo, chave, revisado_por: autor, observacao: `${obs}. ${MOTIVO}` },
        { onConflict: "tipo,chave", ignoreDuplicates: true },
      ),
    );

  for (const [num, data, ev] of DATAS_INICIO) {
    await executar(`registro ${num}: data_ini = ${data} (${ev})`, () =>
      db.from("registros").update({ data_ini: data }, { count: "exact" }).eq("num", num).is("data_ini", null),
    );
  }
  for (const num of ENCERRAMENTOS_CONFIRMADOS) await revisar("data_encerramento", String(num), "Abreviação do mês inequívoca; dia 1º por convenção");
  for (const [num, ev] of VALORES_SEM_NUMERO) await revisar("valor_texto", String(num), `Sem valor numérico único: ${ev}`);
  for (const num of UNIFICACOES_CONFIRMADAS) await revisar("cliente_unificado", num, "Erro de digitação evidente na grafia original");
  for (const chave of DIVERGENCIAS_CONFERIDAS) await revisar("faturamento_divergente", chave, "O sistema soma todas as notas; total digitado na planilha estava incompleto");

  for (const [a, b] of CLIENTES_DIFERENTES) {
    const [ia, ib] = [await idCliente(a), await idCliente(b)];
    if (ia && ib) await revisar("cliente_duplicado", `${ia}-${ib}`, `“${a}” e “${b}” são empresas diferentes (contatos e áreas distintos)`);
  }

  for (const [origem, destino, ev] of UNIFICAR) {
    const [io, id] = [await idCliente(origem), await idCliente(destino)];
    if (!io || !id) {
      console.log(`[pulado] ${origem} → ${destino}: já unificado ou inexistente`);
      continue;
    }
    // Mesma regra da função unificar_clientes (que exige um admin logado): a grafia antiga vai para empresa_original.
    await executar(`unificar ${origem} → ${destino} (${ev}): registros sem grafia original`, () =>
      db.from("registros").update({ cliente_id: id, empresa_original: origem }, { count: "exact" }).eq("cliente_id", io).is("empresa_original", null),
    );
    await executar(`unificar ${origem} → ${destino}: demais registros`, () =>
      db.from("registros").update({ cliente_id: id }, { count: "exact" }).eq("cliente_id", io),
    );
    await executar(`unificar ${origem} → ${destino}: notas`, () =>
      db.from("notas_fiscais").update({ cliente_id: id }, { count: "exact" }).eq("cliente_id", io),
    );
    await executar(`excluir cadastro ${origem} (fica no histórico)`, () => db.from("clientes").delete({ count: "exact" }).eq("id", io));
  }

  for (const [idAcomp, num, ev] of ACOMPANHAMENTOS) {
    await executar(`acompanhamento #${idAcomp} → registro ${num} (${ev})`, () =>
      db.from("acompanhamentos").update({ registro_num: num }, { count: "exact" }).eq("id", idAcomp).is("registro_num", null),
    );
  }

  for (const n of NOTAS) {
    const cliente = await idCliente(n.cliente);
    if (!cliente) throw new Error(`Cliente ${n.cliente} não encontrado`);
    const linha: Record<string, number> = { cliente_id: cliente };
    if (n.registro) linha.registro_num = n.registro;
    await executar(`nota ${n.id} → ${n.cliente}${n.registro ? ` / registro ${n.registro}` : ""} (${n.evidencia})`, () =>
      db.from("notas_fiscais").update(linha, { count: "exact" }).eq("id", n.id).is("cliente_id", null),
    );
  }

  const { count } = await db.from("vw_pendencias").select("*", { count: "exact", head: true });
  console.log(`\n${APLICAR ? `${alteracoes} operações aplicadas.` : "Simulação: nada foi gravado."} Pendências abertas agora: ${count}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
