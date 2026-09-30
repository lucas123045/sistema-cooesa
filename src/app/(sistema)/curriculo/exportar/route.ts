import type { NextRequest } from "next/server";
import { carimboArquivo, gerarXLSX, lerTudo, respostaArquivo, type Coluna } from "@/lib/exportar";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";
import type { LinhaCurriculo } from "@/lib/tipos";

export async function GET(request: NextRequest) {
  if (!(await obterSessao())) return new Response("Não autorizado", { status: 401 });
  const q = request.nextUrl.searchParams;
  const incluiAndamento = q.get("andamento") === "1";
  const valores = q.get("valores") === "1";
  const ano = (s: string | null) => s && /^\d{4}$/.test(s) ? Number(s) : null;
  const de = ano(q.get("de"));
  const ate = ano(q.get("ate"));
  const filtros = ["setor", "area", "empreendimento", "servico", "especialidade"] as const;
  const db = await criarClienteServidor();
  const todos = await lerTudo<LinhaCurriculo>((inicio, fim) =>
    db.from("vw_curriculo").select("*").order("ano", { ascending: false }).range(inicio, fim),
  );
  const linhas = todos.filter((x) =>
    (incluiAndamento || x.situacao === "Contrato encerrado") &&
    (!de || x.ano >= de) && (!ate || x.ano <= ate) &&
    filtros.every((campo) => !q.get(campo) || x[campo] === q.get(campo)),
  );
  const colunas: Coluna<LinhaCurriculo>[] = [
    { titulo: "Nº", valor: (x) => x.num, tipo: "numero" },
    { titulo: "Ano", valor: (x) => x.ano, tipo: "numero" },
    { titulo: "Cliente", valor: (x) => x.cliente },
    { titulo: "Escopo", valor: (x) => x.escopo },
    { titulo: "Situação", valor: (x) => x.situacao },
    { titulo: "Setor", valor: (x) => x.setor },
    { titulo: "Área", valor: (x) => x.area },
    { titulo: "Empreendimento", valor: (x) => x.empreendimento },
    { titulo: "Serviço", valor: (x) => x.servico },
    { titulo: "Especialidade", valor: (x) => x.especialidade },
    ...(valores ? [{ titulo: "Valor (T = mensal)", valor: (x: LinhaCurriculo) => x.valor === null ? null : Number(x.valor), tipo: "moeda" as const }] : []),
  ];
  const arquivo = await gerarXLSX([{ nome: "Currículo técnico", titulo: "Cooesa Engenharia — Currículo técnico", subtitulo: `${linhas.length} contratos`, colunas, linhas }]);
  return respostaArquivo(arquivo, `cooesa-curriculo-${carimboArquivo()}.xlsx`, "xlsx");
}
