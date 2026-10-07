import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const RAIZ = join(__dirname, "..", "..");
const PASTA_MIGRACOES = join(RAIZ, "supabase", "migrations");

/** Cria um Postgres em memória com o ambiente do Supabase simulado e todas as migrações aplicadas. */
export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  const arquivos = readdirSync(PASTA_MIGRACOES)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    try {
      await db.exec(readFileSync(join(PASTA_MIGRACOES, arquivo), "utf8"));
    } catch (e) {
      throw new Error(`Falha ao aplicar ${arquivo}: ${(e as Error).message}`);
    }
  }
  return db;
}

export type PapelBanco = "anon" | "authenticated" | "service_role";

/**
 * Executa `fn` como um usuário do Supabase: define o JWT (sub) e troca o papel
 * do Postgres, como faz o PostgREST. Tudo numa transação desfeita no fim
 * (a menos que `manter` seja true).
 */
export async function como<T>(
  db: PGlite,
  papel: PapelBanco,
  sub: string | null,
  fn: (tx: Transaction) => Promise<T>,
  manter = false,
  aal: "aal1" | "aal2" = "aal1",
): Promise<T> {
  let resultado!: T;
  let erro: unknown;
  try {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub, role: papel, aal })]);
      await tx.exec(`set local role ${papel}`);
      resultado = await fn(tx);
      if (!manter) throw new DesfazerTransacao();
    });
  } catch (e) {
    if (!(e instanceof DesfazerTransacao)) erro = e;
  }
  if (erro) throw erro;
  return resultado;
}

class DesfazerTransacao extends Error {}

/** Cria um usuário no auth.users (dispara a criação do perfil) e define o papel. */
export async function criarUsuario(db: PGlite, email: string, papel: "admin" | "editor" | "leitura" | null) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_app_meta_data) values ($1, $2) returning id", [
    email,
    JSON.stringify(papel ? { papel } : {}),
  ]);
  const id = r.rows[0].id;
  if (papel === null) await db.query("delete from public.perfis where user_id = $1", [id]);
  return id;
}

export function lerDadosPlanilha(): unknown {
  return JSON.parse(readFileSync(join(RAIZ, "data", "cooesa_dados.json"), "utf8"));
}
