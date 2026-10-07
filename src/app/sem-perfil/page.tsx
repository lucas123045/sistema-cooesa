import type { Metadata } from "next";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { sair } from "@/app/login/acoes";

export const metadata: Metadata = { title: "Conta sem perfil" };

export default function PaginaSemPerfil() {
  return (
    <LayoutAcesso>
      <h1>Conta sem perfil de acesso</h1>
      <p className="texto-2">
        Sua conta existe, mas ainda não tem um papel (leitura, editor ou administrador). Peça ao administrador do sistema para
        definir o seu papel em Configurações → Usuários.
      </p>
      <form action={sair}>
        <button className="btn" type="submit">
          Sair
        </button>
      </form>
    </LayoutAcesso>
  );
}
