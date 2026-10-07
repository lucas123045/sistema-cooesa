import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { conferirCarga, formatarConferencia, type DadosConferencia } from "@/lib/conferencia-carga";
import { lerDadosPlanilha, criarBanco } from "./banco";

let db: PGlite;

async function importar() {
  await db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    await tx.query("select public.importar_planilha($1::jsonb)", [JSON.stringify(lerDadosPlanilha())]);
  });
}

async function lerConferencia(): Promise<DadosConferencia> {
  const um = async <T>(sql: string) => (await db.query<T>(sql)).rows;
  return {
    resumo: (await um<DadosConferencia["resumo"]>("select * from vw_resumo"))[0],
    situacoes: await um("select situacao, quantidade from vw_contagem_situacoes"),
    faturamentoAnual: await um("select ano, quantidade, total from vw_faturamento_anual"),
    acompanhamentos: (await um<DadosConferencia["acompanhamentos"]>("select * from vw_contagem_acompanhamentos"))[0],
  };
}

beforeAll(async () => {
  db = await criarBanco();
  await importar();
});

describe("carga da planilha (critério de aceite da Fase 2)", () => {
  it("todos os números da seção 4.6 batem", async () => {
    const itens = conferirCarga(await lerConferencia());
    const divergentes = itens.filter((i) => !i.ok);
    if (divergentes.length) console.error(formatarConferencia(itens));
    expect(divergentes).toEqual([]);
  });

  it("é idempotente: rodar de novo não duplica nada nem gera histórico", async () => {
    const contar = async () =>
      (
        await db.query<Record<string, number>>(`select
          (select count(*)::int from clientes) clientes,
          (select count(*)::int from registros) registros,
          (select count(*)::int from acompanhamentos) acompanhamentos,
          (select count(*)::int from notas_fiscais) notas,
          (select count(*)::int from taxonomia) taxonomia,
          (select count(*)::int from configuracoes) configuracoes,
          (select count(*)::int from historico_alteracoes) historico`)
      ).rows[0];
    const antes = await contar();
    await importar();
    expect(await contar()).toEqual(antes);
    expect((await conferirCarga(await lerConferencia())).every((i) => i.ok)).toBe(true);
  });

  it("preserva os textos originais e o Nº da planilha", async () => {
    const r = await db.query<{
      num: number;
      data_ini: string | null;
      data_ini_texto: string;
      valor: string | null;
      valor_texto: string;
    }>("select num, data_ini, data_ini_texto, valor, valor_texto from registros where num in (407, 838) order by num");
    expect(r.rows[0]).toMatchObject({ num: 407, data_ini: null, data_ini_texto: "125.04.06" });
    expect(r.rows[1]).toMatchObject({ num: 838, valor: null, valor_texto: "15 milhões" });
    const unificado = await db.query<{ empresa_original: string; nome: string }>(
      "select r.empresa_original, c.nome from registros r join clientes c on c.id = r.cliente_id where r.num = 218",
    );
    expect(unificado.rows[0]).toEqual({ empresa_original: "SCHAIN", nome: "SCHAHIN" });
  });

  it("a sequência de novos registros continua em 1060", async () => {
    const r = await db.query<{ n: number }>("select nextval('registros_num_seq')::int as n");
    expect(r.rows[0].n).toBe(1060);
  });

  it("o histórico registra a origem como importação da planilha", async () => {
    const r = await db.query<{ usuario: string; n: number }>(
      "select usuario, count(*)::int as n from historico_alteracoes where tabela = 'registros' group by usuario",
    );
    expect(r.rows).toEqual([{ usuario: "importação da planilha", n: 1059 }]);
  });

  it("vínculos de notas: 6 com registro, clientes por nome exato", async () => {
    const r = await db.query<{ com_registro: number; sem_cliente: number; sem_empresa: number }>(`select
      count(*) filter (where registro_num is not null)::int as com_registro,
      count(*) filter (where cliente_id is null)::int as sem_cliente,
      count(*) filter (where empresa_texto is null)::int as sem_empresa
      from notas_fiscais`);
    expect(r.rows[0].com_registro).toBe(6);
    expect(r.rows[0].sem_empresa).toBe(7);
  });

  it("lista as pendências conhecidas da seção 4.5", async () => {
    const r = await db.query<{ tipo: string; n: number }>(
      "select tipo, count(*)::int as n from vw_pendencias group by tipo order by tipo",
    );
    const porTipo = Object.fromEntries(r.rows.map((x) => [x.tipo, x.n]));
    expect(porTipo).toMatchObject({
      data_inicio: 9,
      data_encerramento: 18,
      valor_texto: 15,
      sem_situacao: 1,
      sem_escopo: 1,
      cliente_unificado: 5,
      acompanhamento_nao_vinculado: 12,
      nota_incompleta: 7,
      faturamento_divergente: 2,
    });
    expect(porTipo.cliente_duplicado).toBeGreaterThanOrEqual(6);
    expect(porTipo.nota_cliente_nao_cadastrado).toBeGreaterThan(0);
  });

  it("taxonomia e alíquotas carregadas", async () => {
    const t = await db.query<{ n: number }>("select count(*)::int as n from taxonomia");
    expect(t.rows[0].n).toBeGreaterThanOrEqual(20);
    const a = await db.query<Record<string, string>>("select * from vw_aliquotas");
    const soma = Object.values(a.rows[0]).reduce((s, v) => s + Number(v), 0);
    expect(soma).toBeCloseTo(16.758, 3);
  });

  it("resumo anual cobre de 2000 até o ano atual e bate com o total", async () => {
    const r = await db.query<{ ano: number; propostas: number }>("select ano, propostas from vw_resumo_anual");
    expect(r.rows[0].ano).toBe(2000);
    expect(r.rows.at(-1)!.ano).toBe(Math.max(new Date().getFullYear(), 2026));
    expect(r.rows.reduce((s, x) => s + x.propostas, 0)).toBe(1059);
  });

  it("busca ignora acentos e maiúsculas", async () => {
    const termo = "segurança de barragem".normalize("NFD").replace(/[̀-ͯ]/g, "");
    const r = await db.query<{ n: number }>("select count(*)::int as n from registros where busca like $1", [`%${termo}%`]);
    expect(r.rows[0].n).toBeGreaterThan(5);
  });
});
