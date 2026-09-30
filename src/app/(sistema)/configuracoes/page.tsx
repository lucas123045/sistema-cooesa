import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { criarClienteServidor, exigirSessao } from "@/lib/supabase/server";
import { salvarAliquotas } from "./acoes";

export const metadata: Metadata = { title: "Configurações" };
const campos = [
  ["aliquota_irpj", "IRPJ"],
  ["aliquota_csll", "CSLL"],
  ["aliquota_cofins", "COFINS"],
  ["aliquota_pis", "PIS"],
  ["aliquota_inss", "INSS"],
  ["aliquota_iss", "ISS"],
] as const;

export default async function Configuracoes(props: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  await exigirSessao("admin");
  const query = await props.searchParams;
  const db = await criarClienteServidor();
  const { data, error } = await db
    .from("configuracoes")
    .select("chave,valor,descricao")
    .in(
      "chave",
      campos.map(([k]) => k),
    );
  const valores = new Map((data ?? []).map((x) => [x.chave, x]));
  return (
    <>
      <CabecalhoPagina
        sobre="Administração"
        titulo="Configurações"
        descricao="Alíquotas estimadas aplicadas sobre o valor das notas fiscais."
        acoes={
          <Link className="btn" href="/configuracoes/usuarios">
            Usuários e permissões
          </Link>
        }
      />
      <section className="painel">
        <div className="painel-corpo">
          {query.salvo ? <p className="aviso aviso-sucesso">Alíquotas atualizadas.</p> : null}
          {query.erro ? (
            <p className="aviso aviso-erro">
              {query.erro === "valor"
                ? "Todas as alíquotas precisam de um número entre 0 e 100 (ex.: 4,0219)."
                : "Não foi possível salvar as alíquotas. Tente de novo."}
            </p>
          ) : null}
          <p className="aviso aviso-alerta">São estimativas históricas e afetam os cálculos exibidos no faturamento.</p>
          {error ? (
            <p className="aviso aviso-erro">Não foi possível ler as configurações.</p>
          ) : (
            <form action={salvarAliquotas} className="formulario">
              {campos.map(([chave, nome]) => (
                <div className="campo c-6" key={chave}>
                  <label htmlFor={chave}>{nome} (%)</label>
                  <input
                    id={chave}
                    name={chave}
                    type="text"
                    inputMode="decimal"
                    defaultValue={String(valores.get(chave)?.valor ?? "").replace(".", ",")}
                    required
                  />
                  <span className="ajuda">{valores.get(chave)?.descricao}</span>
                </div>
              ))}
              <div className="campo c-12">
                <button className="btn btn-primario" type="submit">
                  Salvar alíquotas
                </button>
              </div>
            </form>
          )}
          <p className="ajuda">
            A coluna “K COOESA COM ADM” da planilha não é calculada; seu significado ainda precisa ser confirmado.
          </p>
        </div>
      </section>
    </>
  );
}
