import { Navegacao } from "@/components/Navegacao";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";

async function contarPendencias(): Promise<number | null> {
  const supabase = await criarClienteServidor();
  const { count, error } = await supabase.from("vw_pendencias").select("*", { count: "exact", head: true });
  return error ? null : count;
}

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao();
  const pendencias = await contarPendencias();
  return (
    <div className="estrutura">
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
