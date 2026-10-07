import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { como, criarBanco, criarUsuario, lerDadosPlanilha } from "./banco";

let db: PGlite;
let admin: string;
let editor: string;
let leitor: string;
let semPerfil: string;

beforeAll(async () => {
  db = await criarBanco();
  await db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    await tx.query("select public.importar_planilha($1::jsonb)", [JSON.stringify(lerDadosPlanilha())]);
  });
  admin = await criarUsuario(db, "admin@cooesa.test", "admin");
  editor = await criarUsuario(db, "editor@cooesa.test", "editor");
  leitor = await criarUsuario(db, "leitor@cooesa.test", "leitura");
  semPerfil = await criarUsuario(db, "semperfil@cooesa.test", null);
});

const contar = async (tx: Transaction, sql: string) => (await tx.query<{ n: number }>(sql)).rows[0].n;
const idCliente = async (nome: string) =>
  (await db.query<{ id: number }>("select id from clientes where nome = $1", [nome])).rows[0].id;

describe("RLS por papel", () => {
  it("anônimo não lê nenhuma tabela nem view", async () => {
    for (const t of ["registros", "clientes", "notas_fiscais", "acompanhamentos", "historico_alteracoes", "vw_resumo", "vw_registros", "configuracoes"]) {
      await expect(como(db, "anon", null, (tx) => tx.query(`select * from ${t} limit 1`))).rejects.toThrow(/permission denied/);
    }
  });

  it("usuário logado sem perfil não vê nada", async () => {
    const n = await como(db, "authenticated", semPerfil, (tx) => contar(tx, "select count(*)::int as n from registros"));
    expect(n).toBe(0);
  });

  it("leitura lê tudo, inclusive views", async () => {
    await como(db, "authenticated", leitor, async (tx) => {
      expect(await contar(tx, "select count(*)::int as n from registros")).toBe(1059);
      expect(await contar(tx, "select contratos_totais as n from vw_resumo")).toBe(340);
      expect(await contar(tx, "select count(*)::int as n from notas_fiscais")).toBe(121);
    });
  });

  it("leitura não cria, não edita e não exclui", async () => {
    await como(db, "authenticated", leitor, async (tx) => {
      const upd = await tx.query("update registros set obs = 'x' where num = 1");
      expect(upd.affectedRows).toBe(0);
      const del = await tx.query("delete from notas_fiscais where true");
      expect(del.affectedRows).toBe(0);
    });
    await expect(
      como(db, "authenticated", leitor, (tx) =>
        tx.query("insert into registros (cliente_id, escopo, situacao, tipo, ano) values (1, 'Teste', 'Proposta colocada', 'P', 2026)"),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("editor cria e edita registro; o número segue a partir de 1060", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      const r = await tx.query<{ num: number; criado_por: string }>(
        "insert into registros (cliente_id, escopo, situacao, tipo, valor, criado_por) values (1, 'Estudo de teste', 'Proposta colocada', 'P', 1000, $1) returning num, criado_por",
        [admin], // tentativa de forjar o autor: o trigger substitui pelo usuário real
      );
      // >= porque sequências não voltam atrás: a tentativa recusada do usuário "leitura"
      // acima já consumiu um número (lacunas na numeração são normais).
      expect(r.rows[0].num).toBeGreaterThanOrEqual(1060);
      expect(r.rows[0].criado_por).toBe(editor);
      const upd = await tx.query("update registros set situacao = 'Contrato em andamento' where num = $1", [r.rows[0].num]);
      expect(upd.affectedRows).toBe(1);
    });
  });

  it("editor não exclui registro (só admin)", async () => {
    const n = await como(db, "authenticated", editor, async (tx) => (await tx.query("delete from registros where num = 5")).affectedRows);
    expect(n).toBe(0);
    const nAdmin = await como(db, "authenticated", admin, async (tx) => (await tx.query("delete from registros where num = 5")).affectedRows);
    expect(nAdmin).toBe(1); // desfeito no fim da transação de teste
  });

  it("novo registro exige situação e escopo (o legado não)", async () => {
    await expect(
      como(db, "authenticated", editor, (tx) =>
        tx.query("insert into registros (cliente_id, escopo, tipo) values (1, 'Sem situação', 'P')"),
      ),
    ).rejects.toThrow(/registros_situacao_obrigatoria/);
    await expect(
      como(db, "authenticated", editor, (tx) =>
        tx.query("insert into registros (cliente_id, escopo, situacao, tipo) values (1, '  ', 'Proposta colocada', 'P')"),
      ),
    ).rejects.toThrow(/registros_escopo_obrigatorio/);
  });

  it("situação fora do vocabulário é recusada", async () => {
    await expect(
      como(db, "authenticated", editor, (tx) => tx.query("update registros set situacao = 'Ganhou' where num = 1")),
    ).rejects.toThrow(/registros_situacao_valida/);
  });

  it("só admin altera configurações", async () => {
    const e = await como(db, "authenticated", editor, async (tx) =>
      (await tx.query("update configuracoes set valor = '5' where chave = 'aliquota_iss'")).affectedRows,
    );
    expect(e).toBe(0);
    const a = await como(db, "authenticated", admin, async (tx) =>
      (await tx.query("update configuracoes set valor = '5' where chave = 'aliquota_iss'")).affectedRows,
    );
    expect(a).toBe(1);
  });

  it("ninguém altera nem apaga o histórico pela aplicação", async () => {
    await expect(
      como(db, "authenticated", admin, (tx) => tx.query("delete from historico_alteracoes where true")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(db, "service_role", null, (tx) => tx.query("update historico_alteracoes set usuario = 'x' where true")),
    ).rejects.toThrow(/não pode ser alterado/);
  });

  it("a service_role nunca é necessária na leitura normal (RLS vale nas views)", async () => {
    const n = await como(db, "authenticated", semPerfil, (tx) => contar(tx, "select total_propostas as n from vw_resumo"));
    expect(n).toBe(0);
  });

  it("admin lê todas as tabelas do backup manual; editor não vê perfis alheios", async () => {
    const tabelas = ["clientes", "registros", "acompanhamentos", "notas_fiscais", "taxonomia", "configuracoes", "perfis", "pendencias_revisadas", "avisos_importacao", "historico_alteracoes"];
    await como(db, "authenticated", admin, async (tx) => {
      for (const t of tabelas) expect(await contar(tx, `select count(*)::int as n from ${t}`)).toBeGreaterThanOrEqual(t === "pendencias_revisadas" ? 0 : 1);
      expect(await contar(tx, "select count(*)::int as n from perfis")).toBe(3); // admin, editor e leitor (o 4º não tem perfil)
    });
    expect(await como(db, "authenticated", editor, (tx) => contar(tx, "select count(*)::int as n from perfis"))).toBe(1);
  });

  it("só a service_role executa a importação", async () => {
    await expect(
      como(db, "authenticated", admin, (tx) => tx.query("select importar_planilha('{}'::jsonb)")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("histórico de alterações", () => {
  it("registra quem mudou, quando e o antes/depois", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      await tx.query("update registros set obs = 'Revisado pelo editor' where num = 10");
      const h = await tx.query<{ acao: string; usuario: string; antes: { obs: string | null }; depois: { obs: string } }>(
        "select acao, usuario, antes, depois from historico_alteracoes where tabela = 'registros' and chave = '10' order by id desc limit 1",
      );
      expect(h.rows[0].acao).toBe("update");
      expect(h.rows[0].usuario).toBe("editor");
      expect(h.rows[0].depois.obs).toBe("Revisado pelo editor");
      expect(h.rows[0].antes).not.toHaveProperty("busca");
    });
  });

  it("guarda o conteúdo de um registro excluído", async () => {
    await como(db, "authenticated", admin, async (tx) => {
      await tx.query("delete from registros where num = 7");
      const h = await tx.query<{ antes: { num: number; escopo: string } }>(
        "select antes from historico_alteracoes where tabela = 'registros' and chave = '7' and acao = 'delete'",
      );
      expect(h.rows[0].antes.num).toBe(7);
    });
  });

  it("script com a chave de serviço registra a origem declarada; usuário comum não consegue forjar", async () => {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
      await tx.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-origem-alteracao": "Correção autorizada por Lucas" })]);
      await tx.exec("set local role service_role");
      await tx.query("update registros set obs = 'via script' where num = 12");
    });
    const h = await db.query<{ usuario: string }>("select usuario from historico_alteracoes where tabela = 'registros' and chave = '12' order by id desc limit 1");
    expect(h.rows[0].usuario).toBe("Correção autorizada por Lucas");

    await como(db, "authenticated", editor, async (tx) => {
      await tx.query("select set_config('request.headers', $1, true)", [JSON.stringify({ "x-origem-alteracao": "Outra pessoa" })]);
      await tx.query("update registros set obs = 'pelo editor' where num = 13");
      const r = await tx.query<{ usuario: string }>("select usuario from historico_alteracoes where tabela = 'registros' and chave = '13' order by id desc limit 1");
      expect(r.rows[0].usuario).toBe("editor");
    });
  });

  it("atualização sem mudança real não gera linha no histórico", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      const antes = await contar(tx, "select count(*)::int as n from historico_alteracoes");
      await tx.query("update registros set obs = obs where num = 11");
      expect(await contar(tx, "select count(*)::int as n from historico_alteracoes")).toBe(antes);
    });
  });
});

describe("unificação de clientes", () => {
  it("editor não pode unificar", async () => {
    const [a, b] = [await idCliente("PLANSERVI"), await idCliente("PLANSERV")];
    await expect(como(db, "authenticated", editor, (tx) => tx.query("select unificar_clientes($1, $2)", [a, b]))).rejects.toThrow(
      /Apenas administradores/,
    );
  });

  it("admin unifica: registros e notas passam para o destino e o nome antigo fica registrado", async () => {
    const origem = await idCliente("QUANTA CONSULTORIA");
    const destino = await idCliente("QUANTA");
    await como(db, "authenticated", admin, async (tx) => {
      const nOrigem = await contar(tx, `select count(*)::int as n from registros where cliente_id = ${origem}`);
      const nDestino = await contar(tx, `select count(*)::int as n from registros where cliente_id = ${destino}`);
      const r = await tx.query<{ unificar_clientes: { registros: number } }>("select unificar_clientes($1, $2)", [origem, destino]);
      expect(r.rows[0].unificar_clientes.registros).toBe(nOrigem);
      expect(await contar(tx, `select count(*)::int as n from registros where cliente_id = ${destino}`)).toBe(nOrigem + nDestino);
      expect(await contar(tx, `select count(*)::int as n from clientes where id = ${origem}`)).toBe(0);
      const orig = await tx.query<{ empresa_original: string }>(
        `select distinct empresa_original from registros where cliente_id = ${destino} and empresa_original is not null`,
      );
      expect(orig.rows.map((x) => x.empresa_original)).toContain("QUANTA CONSULTORIA");
      const h = await tx.query<{ antes: { nome: string } }>(
        `select antes from historico_alteracoes where tabela = 'clientes' and chave = '${origem}' and acao = 'delete'`,
      );
      expect(h.rows[0].antes.nome).toBe("QUANTA CONSULTORIA");
      // a busca do registro passa a achar pelo nome novo
      expect(await contar(tx, `select count(*)::int as n from registros where cliente_id = ${destino} and busca like '%quanta%'`)).toBe(
        nOrigem + nDestino,
      );
    });
  });

  it("a pendência de possível duplicado some depois de unificar", async () => {
    const origem = await idCliente("VIVAN ENGENHARIA");
    const destino = await idCliente("VIVAN");
    await como(db, "authenticated", admin, async (tx) => {
      const antes = await contar(tx, "select count(*)::int as n from vw_pendencias where tipo = 'cliente_duplicado' and referencia like 'VIVAN%'");
      expect(antes).toBe(1);
      await tx.query("select unificar_clientes($1, $2)", [origem, destino]);
      expect(await contar(tx, "select count(*)::int as n from vw_pendencias where tipo = 'cliente_duplicado' and referencia like 'VIVAN%'")).toBe(0);
    });
  });

  it("marcar pendência como revisada tira da lista", async () => {
    await como(db, "authenticated", editor, async (tx) => {
      const antes = await contar(tx, "select count(*)::int as n from vw_pendencias where tipo = 'data_encerramento'");
      await tx.query("insert into pendencias_revisadas (tipo, chave) values ('data_encerramento', '59')");
      expect(await contar(tx, "select count(*)::int as n from vw_pendencias where tipo = 'data_encerramento'")).toBe(antes - 1);
    });
  });
});
