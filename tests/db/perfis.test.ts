import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, criarUsuario } from "./banco";

let db: PGlite;
let admin: string;
let editor: string;
let leitor: string;

beforeAll(async () => {
  db = await criarBanco();
  admin = await criarUsuario(db, "admin@cooesa.test", "admin");
  editor = await criarUsuario(db, "editor@cooesa.test", "editor");
  leitor = await criarUsuario(db, "leitor@cooesa.test", "leitura");
});

describe("perfis e papéis", () => {
  it("todo usuário novo ganha perfil; o papel inicial vem só de app_metadata", async () => {
    const id = (
      await db.query<{ id: string }>(
        `insert into auth.users (email, raw_user_meta_data) values ('esperto@x.test', '{"papel":"admin","nome":"Esperto"}') returning id`,
      )
    ).rows[0].id;
    const r = await db.query<{ papel: string; nome: string }>("select papel, nome from perfis where user_id = $1", [id]);
    expect(r.rows[0]).toEqual({ papel: "leitura", nome: "Esperto" });
  });

  it("leitura vê só o próprio perfil", async () => {
    const linhas = await como(db, "authenticated", leitor, async (tx) => (await tx.query("select user_id from perfis")).rows);
    expect(linhas).toEqual([{ user_id: leitor }]);
  });

  it("admin vê todos os perfis", async () => {
    const n = await como(
      db,
      "authenticated",
      admin,
      async (tx) => (await tx.query("select count(*)::int as n from perfis")).rows[0],
    );
    expect((n as { n: number }).n).toBeGreaterThanOrEqual(3);
  });

  it("editor não consegue se promover a admin", async () => {
    const alteradas = await como(db, "authenticated", editor, async (tx) => {
      const r = await tx.query("update perfis set papel = 'admin' where user_id = $1", [editor]);
      return r.affectedRows;
    });
    expect(alteradas).toBe(0);
  });

  it("admin altera o papel de outro usuário", async () => {
    const alteradas = await como(db, "authenticated", admin, async (tx) => {
      const r = await tx.query("update perfis set papel = 'editor' where user_id = $1", [leitor]);
      return r.affectedRows;
    });
    expect(alteradas).toBe(1);
  });

  it("anônimo não lê perfis", async () => {
    await expect(como(db, "anon", null, (tx) => tx.query("select * from perfis"))).rejects.toThrow(/permission denied/);
  });
});
