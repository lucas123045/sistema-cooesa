import { Logo } from "@/components/marca/Logo";

/** Moldura das telas sem sessão (login, recuperação e redefinição de senha). */
export function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="tela-login">
      <section className="tela-login-marca" aria-hidden="true">
        <Logo variante="branco" />
        <p className="lema">Engenharia de energia, barragens e infraestrutura desde 2000.</p>
        <p className="rodape">Cooesa Engenharia S/S Ltda. · Rua Bela Cintra, 299 · São Paulo</p>
      </section>
      <section className="tela-login-form">
        <div className="cartao-login">
          <div className="logo-movel-login">
            <Logo variante="azul" />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
