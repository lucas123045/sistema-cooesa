/**
 * Cria o primeiro administrador (ou promove um usuário existente a admin).
 *
 *   npx tsx --env-file=.env.local scripts/criar-admin.ts email@cooesa.com.br "Nome Completo"
 *
 * A senha é gerada aleatoriamente e mostrada uma única vez; troque no primeiro acesso
 * pela tela "Esqueci a senha" ou em Configurações.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [email, nome] = process.argv.slice(2);
  if (!email) {
    console.error('Uso: npx tsx --env-file=.env.local scripts/criar-admin.ts email@dominio "Nome"');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  const senha = randomBytes(12).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    app_metadata: { papel: "admin" },
    user_metadata: { nome: nome ?? "" },
  });

  let userId = data.user?.id;
  if (error) {
    // Já existe: localiza e só promove.
    const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    userId = lista?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) {
      console.error("Não foi possível criar nem localizar o usuário:", error.message);
      process.exit(1);
    }
    console.log("Usuário já existia; promovendo a admin.");
  } else {
    console.log(`Usuário criado. Senha provisória (anote agora, não será mostrada de novo): ${senha}`);
  }

  const { error: erroPerfil } = await supabase
    .from("perfis")
    .upsert({ user_id: userId, nome: nome ?? email.split("@")[0], papel: "admin" }, { onConflict: "user_id" });
  if (erroPerfil) {
    console.error("Falha ao gravar o perfil:", erroPerfil.message);
    process.exit(1);
  }
  console.log(`${email} agora é admin.`);
}

main();
