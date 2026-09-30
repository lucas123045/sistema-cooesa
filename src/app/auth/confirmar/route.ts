import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Destino dos links enviados por e-mail (recuperação de senha e convite).
 * O modelo de e-mail do Supabase deve apontar para
 *   {{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery&proximo=/redefinir-senha
 * (ver README, seção "Autenticação").
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const codigo = url.searchParams.get("code");
  const proximoBruto = url.searchParams.get("proximo") ?? "/";
  // só caminhos internos, para não virar redirecionamento aberto
  const proximo = proximoBruto.startsWith("/") && !proximoBruto.startsWith("//") ? proximoBruto : "/";

  const supabase = await criarClienteServidor();
  let ok = false;
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    ok = !error;
  } else if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    ok = !error;
  }

  const destino = url.clone();
  destino.search = "";
  if (ok) {
    destino.pathname = proximo;
  } else {
    destino.pathname = "/login";
    destino.searchParams.set("erro", "link");
  }
  return NextResponse.redirect(destino);
}
