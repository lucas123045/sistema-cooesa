import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { como, criarBanco, criarUsuario, lerDadosPlanilha } from "./banco";

// CNPJs de exemplo com dígitos verificadores válidos (não são de empresas reais do acervo).
const CNPJ_A = "11222333000181";
const CNPJ_B = "11444777000161";

let db: PGlite;
let admin: string;
let editor: string;
let leitor: string;

beforeAll(async () => {
  db = await criarBanco();
  await db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    await tx.query("select public.importar_planilha($1::jsonb)", [JSON.stringify(lerDadosPlanilha())]);
  });
  admin = await criarUsuario(db, "admin@cooesa.test", "admin");
  editor = await criarUsuario(db, "editor@cooesa.test", "editor");
  leitor = await criarUsuario(db, "leitor@cooesa.test", "leitura");
});

const um = async <T>(tx: Transaction, sql: string, params: unknown[] = []) => (await tx.query<T>(sql, params)).rows[0];
const idCliente = async (nome: string) =>
  (await db.query<{ id: number }>("select id from clientes where nome = $1", [nome])).rows[0].id;

describe("CNPJ", () => {
  it("valida os dígitos verificadores", async () => {
    const r = await db.query<{ a: boolean; b: boolean; errado: boolean; iguais: boolean; curto: boolean }>(
      `select cnpj_valido($1) a, cnpj_valido($2) b, cnpj_valido('11222333000182') errado,
              cnpj_valido('11111111111111') iguais, cnpj_valido('1122233300018') curto`,
      [CNPJ_A, CNPJ_B],
    );
    expect(r.rows[0]).toEqual({ a: true, b: true, errado: false, iguais: false, curto: false });
  });

  it("recusa CNPJ inválido e CNPJ repetido; vazio é permitido", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      await tx.query("insert into clientes (nome, cnpj) values ('EMPRESA TESTE A', $1)", [CNPJ_A]);
      await tx.query("insert into clientes (nome) values ('EMPRESA SEM CNPJ')");
    });
    await expect(
      como(db, "authenticated", editor, (tx) => tx.query("insert into clientes (nome, cnpj) values ('X', '11222333000182')")),
    ).rejects.toThrow(/clientes_cnpj_valido/);
    await expect(
      como(db, "authenticated", editor, async (tx) => {
        await tx.query("insert into clientes (nome, cnpj) values ('EMPRESA 1', $1)", [CNPJ_A]);
        await tx.query("insert into clientes (nome, cnpj) values ('EMPRESA 2', $1)", [CNPJ_A]);
      }),
    ).rejects.toThrow(/clientes_cnpj_unico/);
  });
});

describe("cadastro da empresa", () => {
  it("status fora do vocabulário e UF inválida são recusados", async () => {
    await expect(
      como(db, "authenticated", editor, (tx) => tx.query("update clientes set status = 'Ótimo' where nome = 'CPFL'")),
    ).rejects.toThrow(/clientes_status_valido/);
    await expect(
      como(db, "authenticated", editor, (tx) => tx.query("update clientes set uf = 'XX' where nome = 'CPFL'")),
    ).rejects.toThrow(/clientes_uf_valida/);
  });

  it("empresas legadas continuam válidas sem status", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int n from clientes where status is null");
    expect(r.rows[0].n).toBe(332);
  });

  it("editor edita o cadastro, mas não renomeia; admin renomeia", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      const r = await tx.query(
        "update clientes set status = 'Cliente ativo', cidade = 'Campinas', uf = 'SP' where nome = 'CPFL'",
      );
      expect(r.affectedRows).toBe(1);
    });
    await expect(
      como(db, "authenticated", editor, (tx) => tx.query("update clientes set nome = 'CPFL ENERGIA' where nome = 'CPFL'")),
    ).rejects.toThrow(/Só administradores podem renomear/);
    const n = await como(
      db,
      "authenticated",
      admin,
      async (tx) => (await tx.query("update clientes set nome = 'CPFL ENERGIA' where nome = 'CPFL'")).affectedRows,
    );
    expect(n).toBe(1);
  });

  it("leitura não edita", async () => {
    const n = await como(
      db,
      "authenticated",
      leitor,
      async (tx) => (await tx.query("update clientes set cidade = 'X' where nome = 'CPFL'")).affectedRows,
    );
    expect(n).toBe(0);
  });

  it("a view traz os campos novos, a busca por razão social e a última proposta", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      await tx.query("update clientes set razao_social = 'Companhia Paulista de Força e Luz' where nome = 'CPFL'");
      const r = await um<{ busca: string; razao_social: string; ultima_proposta: string; propostas: number }>(
        tx,
        "select busca, razao_social, ultima_proposta, propostas from vw_clientes where nome = 'CPFL'",
      );
      expect(r.busca).toContain("companhia paulista de forca e luz");
      expect(r.propostas).toBeGreaterThan(10);
      expect(r.ultima_proposta).not.toBeNull();
    });
  });
});

describe("status sugerido", () => {
  it("segue a regra aprovada e soma 332 empresas da carga", async () => {
    const r = await db.query<{ status_sugerido: string; n: number }>(
      "select status_sugerido, count(*)::int n from vw_clientes group by 1 order by 1",
    );
    const porStatus = Object.fromEntries(r.rows.map((x) => [x.status_sugerido, x.n]));
    expect(Object.keys(porStatus).sort()).toEqual(["Cliente ativo", "Cliente inativo", "Proposta em andamento", "Prospecção"]);
    expect(Object.values(porStatus).reduce((s, n) => s + n, 0)).toBe(332);
  });

  it("só admin aplica, e nunca sobrescreve um status escolhido", async () => {
    await expect(como(db, "authenticated", editor, (tx) => tx.query("select aplicar_status_sugerido()"))).rejects.toThrow(
      /Só administradores/,
    );
    await como(db, "authenticated", admin, async (tx) => {
      await tx.query("update clientes set status = 'Não atender' where nome = 'GE'");
      const r = await um<{ aplicar_status_sugerido: Record<string, number> }>(tx, "select aplicar_status_sugerido()");
      const total = Object.values(r.aplicar_status_sugerido).reduce((s, n) => s + n, 0);
      expect(total).toBe(331);
      expect((await um<{ status: string }>(tx, "select status from clientes where nome = 'GE'")).status).toBe("Não atender");
      expect((await um<{ n: number }>(tx, "select count(*)::int n from clientes where status is null")).n).toBe(0);
    });
  });
});

describe("contatos da empresa", () => {
  it("leitura vê, não cria; editor cria, edita e remove", async () => {
    const cpfl = await idCliente("CPFL");
    await expect(
      como(db, "authenticated", leitor, (tx) =>
        tx.query("insert into contatos_empresa (cliente_id, nome) values ($1, 'Ana')", [cpfl]),
      ),
    ).rejects.toThrow(/row-level security/);
    await como(db, "authenticated", editor, async (tx) => {
      const r = await um<{ id: number }>(
        tx,
        "insert into contatos_empresa (cliente_id, nome, email, principal) values ($1, 'Ana', 'ana@exemplo.com', true) returning id",
        [cpfl],
      );
      expect((await tx.query("update contatos_empresa set cargo = 'Engenheira' where id = $1", [r.id])).affectedRows).toBe(1);
      expect((await tx.query("delete from contatos_empresa where id = $1", [r.id])).affectedRows).toBe(1);
      const h = await tx.query(
        "select acao from historico_alteracoes where tabela = 'contatos_empresa' and chave = $1 order by id",
        [String(r.id)],
      );
      expect(h.rows.map((x) => (x as { acao: string }).acao)).toEqual(["insert", "update", "delete"]);
    });
  });

  it("no máximo um contato principal por empresa e e-mail válido", async () => {
    const cpfl = await idCliente("CPFL");
    await expect(
      como(db, "authenticated", editor, async (tx) => {
        await tx.query("insert into contatos_empresa (cliente_id, nome, principal) values ($1, 'A', true)", [cpfl]);
        await tx.query("insert into contatos_empresa (cliente_id, nome, principal) values ($1, 'B', true)", [cpfl]);
      }),
    ).rejects.toThrow(/contatos_um_principal/);
    await expect(
      como(db, "authenticated", editor, (tx) =>
        tx.query("insert into contatos_empresa (cliente_id, nome, email) values ($1, 'C', 'sem-arroba')", [cpfl]),
      ),
    ).rejects.toThrow(/contatos_email_valido/);
  });

  it("anônimo não lê contatos", async () => {
    await expect(como(db, "anon", null, (tx) => tx.query("select * from contatos_empresa"))).rejects.toThrow(/permission denied/);
  });
});

describe("unificação com o cadastro novo", () => {
  it("leva os contatos e completa os campos vazios do destino sem sobrescrever", async () => {
    const origem = await idCliente("QUANTA CONSULTORIA");
    const destino = await idCliente("QUANTA");
    await como(db, "authenticated", admin, async (tx) => {
      await tx.query(
        "update clientes set cnpj = $1, cidade = 'Belo Horizonte', uf = 'MG', status = 'Cliente ativo' where id = $2",
        [CNPJ_B, origem],
      );
      await tx.query("update clientes set cidade = 'São Paulo', status = 'Prospecção' where id = $1", [destino]);
      await tx.query("insert into contatos_empresa (cliente_id, nome, principal) values ($1, 'Pedro', true)", [origem]);
      await tx.query("insert into contatos_empresa (cliente_id, nome, principal) values ($1, 'Maria', true)", [destino]);

      const r = await um<{ unificar_clientes: { contatos: number } }>(tx, "select unificar_clientes($1, $2)", [origem, destino]);
      expect(r.unificar_clientes.contatos).toBe(1);

      const d = await um<{ cnpj: string; cidade: string; uf: string; status: string }>(
        tx,
        "select cnpj, cidade, uf, status from clientes where id = $1",
        [destino],
      );
      expect(d).toEqual({ cnpj: CNPJ_B, cidade: "São Paulo", uf: "MG", status: "Prospecção" });

      const contatos = await tx.query<{ nome: string; principal: boolean }>(
        "select nome, principal from contatos_empresa where cliente_id = $1 order by nome",
        [destino],
      );
      expect(contatos.rows).toEqual([
        { nome: "Maria", principal: true },
        { nome: "Pedro", principal: false },
      ]);
    });
  });
});
