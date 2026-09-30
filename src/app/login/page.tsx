import type { Metadata } from "next";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin(props: PageProps<"/login">) {
  const q = await props.searchParams;
  const erroLink = q.erro === "link";
  return (
    <LayoutAcesso>
      <h1>Entrar</h1>
      <p className="texto-2">Acesso restrito à equipe da Cooesa. Contas são criadas pelo administrador.</p>
      {erroLink ? (
        <p className="aviso aviso-erro" role="alert">
          O link de acesso é inválido ou expirou. Peça um novo em “Esqueci a senha”.
        </p>
      ) : null}
      <FormLogin />
    </LayoutAcesso>
  );
}
