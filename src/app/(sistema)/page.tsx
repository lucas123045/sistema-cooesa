import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { exigirSessao } from "@/lib/supabase/server";

export default async function Painel() {
  const sessao = await exigirSessao();
  return (
    <>
      <CabecalhoPagina sobre="Painel" titulo={`Olá, ${sessao.nome}`} descricao="O painel com a linha do tempo da empresa entra na Fase 4." />
    </>
  );
}
