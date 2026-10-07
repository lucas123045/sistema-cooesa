import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor, obterSessao } from "@/lib/supabase/server";

/**
 * Busca rápida do Início: um número que existe abre direto o registro;
 * qualquer outro texto vai para a lista de propostas filtrada.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const destino = request.nextUrl.clone();
  destino.search = "";
  if (!(await obterSessao())) {
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const numero = q.replace(/^n[ºo°]?\s*/i, "");
  if (/^\d{1,6}$/.test(numero)) {
    const db = await criarClienteServidor();
    const { data } = await db.from("registros").select("num").eq("num", Number(numero)).maybeSingle();
    if (data) {
      destino.pathname = `/registros/${data.num}`;
      return NextResponse.redirect(destino);
    }
  }
  destino.pathname = "/registros";
  if (q) destino.searchParams.set("q", q);
  return NextResponse.redirect(destino);
}
