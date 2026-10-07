import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta (navegador real), SÓ DE LEITURA: não criam nem alteram dados.
 *
 *   E2E_EMAIL=... E2E_SENHA=... npm run e2e
 *
 * - Aponte E2E_URL para o sistema (padrão: http://localhost:3000, com `npm run build && npm start`).
 * - Use uma conta de papel "leitura", sem verificação em dois passos, criada só para os testes.
 * - Sem E2E_EMAIL/E2E_SENHA os testes são pulados (ex.: no CI sem esses secrets).
 * - E2E_CANAL=msedge usa o Edge instalado no Windows (sem baixar navegadores).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    channel: process.env.E2E_CANAL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_CANAL } },
    { name: "celular", use: { ...devices["Pixel 7"], channel: process.env.E2E_CANAL } },
  ],
});
