export const PAPEIS = ["admin", "editor", "leitura"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  editor: "Editor",
  leitura: "Leitura",
};

export function podeEditar(papel: Papel | undefined | null): boolean {
  return papel === "admin" || papel === "editor";
}

export function eAdmin(papel: Papel | undefined | null): boolean {
  return papel === "admin";
}
