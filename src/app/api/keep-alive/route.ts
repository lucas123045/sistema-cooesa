import { timingSafeEqual } from "node:crypto";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return Response.json({ erro: "Keep-alive não configurado." }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+/i.test(authorization)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const enviado = authorization.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(enviado);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  try {
    const { data, error } = await criarClienteAdmin().rpc("keep_alive");
    if (error) return Response.json({ erro: "Não foi possível acessar o banco." }, { status: 503 });
    return Response.json({ ok: true, timestamp: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ erro: "Keep-alive indisponível." }, { status: 503 });
  }
}
