import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { sair } from "@/app/login/acoes";
import { precisaDeCodigo } from "@/lib/supabase/server";
import { FormCodigo } from "./FormCodigo";

export const metadata: Metadata = { title: "Verificação em dois passos" };

export default async function PaginaVerificacao() {
  // Só faz sentido para quem já passou pela senha e tem a verificação ativa.
  if (!(await precisaDeCodigo())) redirect("/");
  return (
    <LayoutAcesso>
      <h1>Verificação em dois passos</h1>
      <p className="texto-2">Abra o aplicativo autenticador no celular e digite o código de 6 números da Cooesa.</p>
      <FormCodigo />
      <form action={sair} style={{ marginTop: 8, textAlign: "center" }}>
        <button className="btn btn-texto" type="submit">
          Sair e entrar com outra conta
        </button>
      </form>
    </LayoutAcesso>
  );
}
