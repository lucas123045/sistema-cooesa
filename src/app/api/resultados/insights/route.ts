import { NextResponse } from "next/server";
import { lerTudo } from "@/lib/consultas";
import { hojeBrasil } from "@/lib/formato";
import { eAdmin } from "@/lib/papeis";
import {
  agregar,
  agregarPor,
  contratadoPorCliente,
  faturadoPorCliente,
  type NotaResultado,
  type RegistroResultado,
} from "@/lib/resultados";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Intervalo mínimo entre análises (cada uma é uma chamada paga). */
const INTERVALO_MINUTOS = 10;

const arred = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * Gera a análise de Resultados com IA. Só admin. Envia apenas agregados (sem nomes de clientes,
 * contatos ou escopos) e salva o texto em configuracoes (chave ia_resultados) para todos verem.
 */
export async function POST() {
  const sessao = await obterSessao();
  if (!sessao) return NextResponse.json({ erro: "Entre no sistema para solicitar uma análise." }, { status: 401 });
  if (!eAdmin(sessao.papel)) return NextResponse.json({ erro: "Só administradores podem gerar a análise." }, { status: 403 });

  const chave = process.env.OPENAI_API_KEY;
  const modelo = process.env.OPENAI_MODEL;
  if (!chave || !modelo) {
    return NextResponse.json(
      {
        erro: "A análise por IA não está configurada: defina OPENAI_API_KEY e OPENAI_MODEL (um modelo habilitado na sua conta) no servidor.",
      },
      { status: 503 },
    );
  }

  const db = await criarClienteServidor();
  const { data: anterior } = await db.from("configuracoes").select("valor").eq("chave", "ia_resultados").maybeSingle();
  const ultima = (anterior?.valor as { gerado_em?: string } | null)?.gerado_em;
  if (ultima && Date.now() - new Date(ultima).getTime() < INTERVALO_MINUTOS * 60_000) {
    return NextResponse.json({ erro: `Aguarde ${INTERVALO_MINUTOS} minutos entre uma análise e outra.` }, { status: 429 });
  }

  let registros: RegistroResultado[];
  let notas: NotaResultado[];
  try {
    [registros, notas] = await Promise.all([
      lerTudo<RegistroResultado>((a, b) =>
        db
          .from("vw_registros")
          .select("num, cliente_id, cliente, situacao, contrato_total, tipo, valor, ano, area, setor, gerente")
          .order("num")
          .range(a, b),
      ),
      lerTudo<NotaResultado>((a, b) =>
        db.from("vw_notas").select("ano, valor, data_emissao, data_credito, cliente_id, cliente").order("id").range(a, b),
      ),
    ]);
  } catch {
    return NextResponse.json({ erro: "Não foi possível carregar os indicadores para a análise." }, { status: 500 });
  }

  const anoAtual = hojeBrasil().ano;
  const ultimoAnoNotas = Math.max(0, ...notas.map((n) => n.ano));
  const resumoAno = (ano: number) => {
    const a = agregar(registros.filter((r) => r.ano === ano));
    return {
      ano,
      parcial: ano === anoAtual,
      propostas: a.propostas,
      contratos: a.contratos,
      sucesso_qtd_pct: arred(a.taxaQuantidade),
      sucesso_valor_p_pct: arred(a.taxaValor),
      proposto_p: a.propostoP,
      contratado_p: a.contratadoP,
      ticket_contratado_p: a.ticketContratadoP,
      faturado_notas: ano <= ultimoAnoNotas ? notas.filter((n) => n.ano === ano).reduce((s, n) => s + Number(n.valor), 0) : null,
    };
  };
  const total = agregar(registros);
  const carteira = contratadoPorCliente(registros);
  const faturamento = faturadoPorCliente(notas);

  // Só agregados. Áreas e setores são categorias técnicas, não dados pessoais nem nomes de clientes.
  const entrada = {
    contexto:
      `Empresa de engenharia consultiva. Valores em reais. Tipo P = valor total; tipo T = valor mensal (não somar nem anualizar). ` +
      `“Contrato” = encerrado ou em andamento. ${anoAtual} é um ano PARCIAL (em andamento). ` +
      `As notas fiscais só estão registradas até ${ultimoAnoNotas}; anos posteriores têm faturado nulo por falta de registro, não por queda. ` +
      `Tributos não estão incluídos. Não há nomes de clientes nos dados.`,
    historico: {
      propostas: total.propostas,
      contratos: total.contratos,
      sucesso_qtd_pct: arred(total.taxaQuantidade),
      sucesso_valor_p_pct: arred(total.taxaValor),
    },
    ultimos_anos: Array.from({ length: 10 }, (_, i) => resumoAno(anoAtual - 9 + i)),
    por_area: agregarPor(
      registros.filter((r) => r.ano >= anoAtual - 9),
      (r) => r.area,
    )
      .filter((x) => x.dados.propostas >= 5)
      .map((x) => ({
        area: x.chave,
        propostas: x.dados.propostas,
        contratos: x.dados.contratos,
        sucesso_qtd_pct: arred(x.dados.taxaQuantidade),
        contratado_p: x.dados.contratadoP,
      })),
    concentracao: {
      carteira_top5_pct: arred(carteira.top5),
      carteira_top10_pct: arred(carteira.top10),
      faturamento_top5_pct: arred(faturamento.top5),
      faturamento_top10_pct: arred(faturamento.top10),
    },
  };

  let texto: string;
  try {
    const resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        instructions:
          "Você é um analista comercial de uma consultoria de engenharia. Responda em português do Brasil, em 4 a 6 frases curtas, uma por linha, " +
          "baseadas SOMENTE nos dados fornecidos. Compare sucesso por quantidade com sucesso por valor, aponte áreas fortes e fracas e comente a concentração de clientes. " +
          "Não trate ano parcial nem ausência de notas como queda. Não invente causas, previsões ou números. Termine com até duas sugestões práticas.",
        input: JSON.stringify(entrada),
        max_output_tokens: 700,
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!resposta.ok) {
      console.error("Serviço de IA retornou status", resposta.status);
      return NextResponse.json(
        {
          erro:
            resposta.status === 404 || resposta.status === 400
              ? `O modelo “${modelo}” não foi aceito. Confira OPENAI_MODEL.`
              : "O serviço de IA não concluiu a análise. Tente mais tarde.",
        },
        { status: 502 },
      );
    }
    const corpo = (await resposta.json()) as { output?: { content?: { type?: string; text?: string }[] }[] };
    texto = (corpo.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((parte) => parte.type === "output_text")
      .map((parte) => parte.text ?? "")
      .join("\n")
      .trim();
  } catch (erro) {
    console.error("Falha ao solicitar análise:", erro instanceof Error ? erro.name : "erro desconhecido");
    return NextResponse.json({ erro: "Não foi possível conectar ao serviço de IA. Tente mais tarde." }, { status: 502 });
  }
  if (!texto) return NextResponse.json({ erro: "O serviço de IA retornou uma resposta vazia." }, { status: 502 });

  const analise = { texto, gerado_em: new Date().toISOString(), gerado_por: sessao.nome, modelo };
  const { error } = await db.from("configuracoes").upsert(
    {
      chave: "ia_resultados",
      valor: analise,
      descricao: "Última análise de Resultados gerada por IA",
      atualizado_por: sessao.userId,
      atualizado_em: analise.gerado_em,
    },
    { onConflict: "chave" },
  );
  if (error) console.error("Análise gerada, mas não foi salva:", error.code);
  return NextResponse.json({ analise }, { headers: { "Cache-Control": "no-store" } });
}
