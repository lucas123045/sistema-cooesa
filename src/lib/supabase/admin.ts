import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service_role: ignora RLS. Uso restrito a rotas de servidor que
 * já verificaram que o usuário é admin (ex.: criar usuários). Nunca importe
 * este arquivo em componentes de cliente — o "server-only" acima quebra o build se isso acontecer.
 */
export function criarClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
