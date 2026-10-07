/**
 * Cadastro de empresas: vocabulário de status, UFs e CNPJ.
 * Os mesmos valores estão nas regras do banco (migração 20261008120000) — há teste conferindo.
 */

export const STATUS_EMPRESA = ["Prospecção", "Proposta em andamento", "Cliente ativo", "Cliente inativo", "Não atender"] as const;
export type StatusEmpresa = (typeof STATUS_EMPRESA)[number];

/** Classe do selo de cada status (cores em globals.css; âmbar fica reservado para alertas). */
export const CLASSE_STATUS: Record<StatusEmpresa, string> = {
  Prospecção: "status-prospeccao",
  "Proposta em andamento": "status-proposta",
  "Cliente ativo": "status-ativo",
  "Cliente inativo": "status-inativo",
  "Não atender": "status-nao-atender",
};

export function eStatusEmpresa(v: unknown): v is StatusEmpresa {
  return typeof v === "string" && (STATUS_EMPRESA as readonly string[]).includes(v);
}

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** CNPJ com 14 dígitos e os dois dígitos verificadores corretos. */
export function cnpjValido(cnpj: string): boolean {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  return digito(d, p1) === Number(d[12]) && digito(d, p2) === Number(d[13]);
}

/** "11222333000181" → "11.222.333/0001-81". */
export function formatarCnpj(cnpj: string | null | undefined): string {
  const d = somenteDigitos(cnpj ?? "");
  if (d.length !== 14) return cnpj ?? "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Endereço do site com https:// (para o link funcionar). */
export function urlSite(site: string | null | undefined): string | null {
  if (!site) return null;
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}
