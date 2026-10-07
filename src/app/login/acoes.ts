"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor, precisaDeCodigo } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string; ok?: string };

const esquemaLogin = z.object({
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
});

export async function entrar(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const r = esquemaLogin.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.senha });
  if (error) {
    return { erro: "E-mail ou senha incorretos. Confira os dados ou use “Esqueci a senha”." };
  }
  // Com verificação em dois passos ativa, a senha sozinha não basta.
  redirect((await precisaDeCodigo()) ? "/verificacao" : "/");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

async function origem() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function recuperarSenha(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const r = z.email().safeParse(dados.get("email"));
  if (!r.success) return { erro: "Informe um e-mail válido." };
  const supabase = await criarClienteServidor();
  await supabase.auth.resetPasswordForEmail(r.data, {
    redirectTo: `${await origem()}/auth/confirmar?proximo=/redefinir-senha`,
  });
  // Mesma resposta exista ou não a conta, para não revelar quem tem acesso.
  return {
    ok: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha em alguns minutos.",
  };
}

const esquemaSenha = z
  .object({
    senha: z.string().min(10, "A senha precisa ter pelo menos 10 caracteres."),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { message: "As duas senhas não são iguais.", path: ["confirmacao"] });

export async function redefinirSenha(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const r = esquemaSenha.safeParse({ senha: dados.get("senha"), confirmacao: dados.get("confirmacao") });
  if (!r.success) return { erro: r.error.issues[0]?.message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: r.data.senha });
  if (error) {
    return { erro: "O link de recuperação expirou. Peça um novo em “Esqueci a senha”." };
  }
  redirect("/");
}

/** Confere o código de 6 dígitos do aplicativo autenticador (verificação em dois passos). */
export async function verificarCodigo(_: EstadoForm, dados: FormData): Promise<EstadoForm> {
  const codigo = String(dados.get("codigo") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(codigo)) return { erro: "Digite os 6 números que aparecem no aplicativo autenticador." };
  const supabase = await criarClienteServidor();
  const { data: fatores, error: erroFatores } = await supabase.auth.mfa.listFactors();
  const fator = fatores?.totp?.[0];
  if (erroFatores || !fator) return { erro: "Sua sessão expirou. Entre de novo com e-mail e senha." };
  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId: fator.id });
  if (erroDesafio || !desafio) return { erro: "Não foi possível iniciar a verificação. Tente de novo." };
  const { error } = await supabase.auth.mfa.verify({ factorId: fator.id, challengeId: desafio.id, code: codigo });
  if (error) return { erro: "Código incorreto ou vencido. Confira o relógio do celular e digite o código atual." };
  redirect("/");
}
