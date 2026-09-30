import "server-only";
import ExcelJS from "exceljs";

export type Coluna<T> = {
  titulo: string;
  valor: (linha: T) => string | number | null | undefined;
  /** "moeda" formata como R$ no Excel; "data" converte aaaa-mm-dd em data. */
  tipo?: "texto" | "numero" | "moeda" | "data";
  largura?: number;
};

/** CSV no formato que o Excel brasileiro abre direto: separador ";", decimal ",", BOM UTF-8. */
export function gerarCSV<T>(colunas: Coluna<T>[], linhas: T[]): string {
  const escapar = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(";"));
  return "﻿" + [cabecalho, ...corpo].join("\r\n") + "\r\n";
}

function dataISOparaDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

export type Planilha<T> = { nome: string; colunas: Coluna<T>[]; linhas: T[]; titulo?: string; subtitulo?: string };

/** Pasta de trabalho .xlsx com uma aba por planilha, cabeçalho congelado e autofiltro. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- abas com tipos de linha diferentes
export async function gerarXLSX(planilhas: Planilha<any>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Cooesa";
  wb.created = new Date();
  for (const p of planilhas) {
    const ws = wb.addWorksheet(p.nome.slice(0, 31));
    let linhaCabecalho = 1;
    if (p.titulo) {
      ws.addRow([p.titulo]).font = { bold: true, size: 14, color: { argb: "FF27364C" } };
      if (p.subtitulo) ws.addRow([p.subtitulo]).font = { size: 10, color: { argb: "FF5F6B79" } };
      ws.addRow([]);
      linhaCabecalho = ws.rowCount + 1;
    }
    const cab = ws.addRow(p.colunas.map((c) => c.titulo));
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.eachCell((cel) => {
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E5B7B" } };
    });
    for (const l of p.linhas) {
      ws.addRow(
        p.colunas.map((c) => {
          const v = c.valor(l);
          if (v === null || v === undefined || v === "") return null;
          if (c.tipo === "data") return dataISOparaDate(v) ?? v;
          if (c.tipo === "moeda" || c.tipo === "numero") return typeof v === "number" ? v : Number(v);
          return v;
        }),
      );
    }
    p.colunas.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.largura ?? Math.min(60, Math.max(10, c.titulo.length + 2));
      if (c.tipo === "moeda") col.numFmt = '"R$" #,##0.00';
      if (c.tipo === "data") col.numFmt = "dd/mm/yyyy";
    });
    ws.views = [{ state: "frozen", ySplit: linhaCabecalho }];
    if (p.linhas.length) {
      ws.autoFilter = {
        from: { row: linhaCabecalho, column: 1 },
        to: { row: linhaCabecalho, column: p.colunas.length },
      };
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

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

export function respostaArquivo(conteudo: string | Buffer, nome: string, tipo: "csv" | "xlsx" | "json"): Response {
  const mime = {
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    json: "application/json; charset=utf-8",
  }[tipo];
  const corpo = typeof conteudo === "string" ? conteudo : new Uint8Array(conteudo);
  return new Response(corpo, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function carimboArquivo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
