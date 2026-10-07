import { Suspense } from "react";
import { BarraProgresso } from "@/components/BarraProgresso";
import { Navegacao } from "@/components/Navegacao";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";

async function contarPendencias(): Promise<number | null> {
  const supabase = await criarClienteServidor();
  const { count, error } = await supabase.from("vw_pendencias").select("*", { count: "exact", head: true });
  return error ? null : count;
}

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <main className="conteudo">
        <section className="painel" style={{ maxWidth: 720, margin: "10vh auto", padding: 24 }}>
          <p className="indicador-rotulo">Configuração necessária</p>
          <h1 style={{ marginBottom: 12 }}>Conecte o projeto ao Supabase</h1>
          <p>O servidor iniciou, mas faltam as credenciais públicas do projeto para carregar os dados e autenticar usuários.</p>
          <ol style={{ paddingLeft: 22, lineHeight: 1.8 }}>
            <li>Copie <code>.env.example</code> para um arquivo chamado <code>.env.local</code> na raiz do projeto.</li>
            <li>No painel Supabase, abra <strong>Project Settings → API</strong> e copie a Project URL e a chave publishable/anon.</li>
            <li>Preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no <code>.env.local</code>.</li>
            <li>Reinicie o servidor de desenvolvimento.</li>
          </ol>
          <p className="nota">Não coloque a chave <code>service_role</code> em variáveis com prefixo <code>NEXT_PUBLIC_</code> nem a compartilhe no navegador.</p>
        </section>
      </main>
    );
  }
  const sessao = await exigirSessao();
  const pendencias = await contarPendencias();
  return (
    <div className="estrutura">
      <Suspense fallback={null}>
        <BarraProgresso />
      </Suspense>
      <a href="#conteudo" className="pular-conteudo">
        Pular para o conteúdo
      </a>
      <Navegacao nome={sessao.nome} papel={sessao.papel} pendencias={pendencias} />
      <main id="conteudo" className="conteudo">
        {children}
      </main>
    </div>
  );
}
