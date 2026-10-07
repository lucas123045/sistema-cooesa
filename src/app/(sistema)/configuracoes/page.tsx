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
  const sessao = await exigirSessao("admin");
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
        icone="configuracoes"
        titulo="Configurações"
        descricao="Alíquotas estimadas aplicadas sobre o valor das notas fiscais."
        acoes={
          <Link className="btn" href="/configuracoes/usuarios">
            Usuários e permissões
          </Link>
        }
      />
      {!sessao.doisPassos ? (
        <p className="aviso aviso-alerta" style={{ marginBottom: 16 }}>
          Sua conta de administrador está protegida só pela senha.{" "}
          <Link href="/conta#dois-passos">Ativar a verificação em dois passos</Link>
        </p>
      ) : null}
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

      <section className="painel" style={{ marginTop: 16 }}>
        <div className="painel-cabecalho">
          <h2>Backup manual</h2>
          <span className="nota">Todas as tabelas, inclusive o histórico de alterações</span>
        </div>
        <div className="painel-corpo">
          <p className="texto-2">
            Além do backup automático semanal (GitHub Actions, guardado por 90 dias), baixe uma cópia antes de mudanças grandes. O
            JSON é uma cópia completa legível por programas; o Excel, para consulta. Para restaurar o banco inteiro, use o dump do
            backup automático (veja o README).
          </p>
          <p className="aviso aviso-alerta">
            O arquivo contém nomes e telefones de contatos (LGPD). Guarde em pasta restrita e não envie por e-mail.
          </p>
          <div className="atalhos" style={{ marginTop: 12 }}>
            <a className="btn btn-primario" href="/configuracoes/backup?formato=json">
              Baixar backup (JSON)
            </a>
            <a className="btn" href="/configuracoes/backup?formato=xlsx">
              Baixar backup (Excel)
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
