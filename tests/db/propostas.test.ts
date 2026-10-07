import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, criarUsuario, lerDadosPlanilha } from "./banco";

let db: PGlite;
let editor: string;

beforeAll(async () => {
  db = await criarBanco();
  await db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    await tx.query("select public.importar_planilha($1::jsonb)", [JSON.stringify(lerDadosPlanilha())]);
  });
  editor = await criarUsuario(db, "editor@cooesa.test", "editor");
});

describe("dados técnicos e comerciais da proposta", () => {
  it("campos novos são opcionais: o legado continua válido e ganha revisão 0", async () => {
    const r = await db.query<{ n: number; rev: number }>(
      "select count(*)::int n, max(revisao)::int rev from registros where modalidade is null",
    );
    expect(r.rows[0]).toEqual({ n: 1059, rev: 0 });
  });

  it("vocabulários, UF e números negativos são validados no banco", async () => {
    const casos: [string, string][] = [
      ["update registros set modalidade = 'Pregão' where num = 1", "registros_modalidade_valida"],
      ["update registros set motivo_perda = 'Azar' where num = 1", "registros_motivo_perda_valido"],
      ["update registros set local_uf = 'XX' where num = 1", "registros_local_uf_valida"],
      ["update registros set potencia_mw = -1 where num = 1", "registros_tecnicos_positivos"],
    ];
    for (const [sql, regra] of casos) {
      await expect(como(db, "authenticated", editor, (tx) => tx.query(sql))).rejects.toThrow(new RegExp(regra));
    }
  });

  it("a mesma chave de envio não cria duas propostas (clique duplo)", async () => {
    const inserir =
      "insert into registros (cliente_id, escopo, situacao, tipo, chave_envio) values (1, 'Teste', 'Proposta colocada', 'P', 'envio-abc')";
    await expect(
      como(db, "authenticated", editor, async (tx) => {
        await tx.query(inserir);
        await tx.query(inserir);
      }),
    ).rejects.toThrow(/registros_chave_envio_unica/);
  });

  it("a busca acha pela obra e pelo cliente final; a chave de envio não vai para o histórico", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      await tx.query(
        "update registros set obra = 'UHE Porto Primavera', cliente_final = 'CESP', chave_envio = 'x1' where num = 2",
      );
      const r = await tx.query<{ busca: string }>("select busca from registros where num = 2");
      expect(r.rows[0].busca).toContain("uhe porto primavera");
      expect(r.rows[0].busca).toContain("cesp");
      const h = await tx.query<{ depois: Record<string, unknown> }>(
        "select depois from historico_alteracoes where tabela = 'registros' and chave = '2' order by id desc limit 1",
      );
      expect(h.rows[0].depois).not.toHaveProperty("chave_envio");
      expect(h.rows[0].depois.obra).toBe("UHE Porto Primavera");
    });
  });
});
