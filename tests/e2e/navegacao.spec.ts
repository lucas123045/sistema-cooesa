import { expect, test, type Page } from "@playwright/test";

// Só leitura: nenhum teste cria, altera ou exclui dados.
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;
test.skip(!EMAIL || !SENHA, "Defina E2E_EMAIL e E2E_SENHA (conta de leitura, sem verificação em dois passos).");

async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill(SENHA!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Painel de Controle" })).toBeVisible();
}

test("sem login, qualquer página leva ao login", async ({ page }) => {
  await page.goto("/registros");
  await expect(page).toHaveURL(/\/login$/);
});

test("senha errada mostra mensagem clara", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL!);
  await page.getByLabel("Senha").fill("senha-errada-de-proposito");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha incorretos");
});

test("todas as áreas abrem a partir do Painel de Controle", async ({ page }) => {
  await entrar(page);
  const areas: [string, RegExp][] = [
    ["Propostas e contratos", /Propostas e contratos/],
    ["Empresas", /Empresas/],
    ["Faturamento", /Faturamento/],
    ["Currículo", /Currículo/],
    ["Visão geral", /Visão geral/],
    ["Resultados", /Resultados/],
    ["Pendências de dados", /Pendências de dados/],
  ];
  for (const [cartao, titulo] of areas) {
    await page.goto("/");
    await page
      .getByRole("link", { name: new RegExp(cartao) })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(page.getByText("Não foi possível carregar")).toHaveCount(0);
  }
});

test("busca na lista e abre o detalhe do registro", async ({ page }) => {
  await entrar(page);
  await page.goto("/registros?q=cpfl");
  const primeiro = page.locator("table.tabela tbody tr").first();
  await expect(primeiro).toContainText("CPFL");
  await primeiro.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/registros\/\d+$/);
  await expect(page.getByRole("heading", { name: "Histórico de alterações" })).toBeVisible();
});

test("empresas: filtra por status e abre o detalhe com contatos e propostas", async ({ page }) => {
  await entrar(page);
  await page.goto("/clientes?q=cpfl");
  await expect(page.getByRole("heading", { level: 1, name: "Empresas" })).toBeVisible();
  await page.locator("table.tabela tbody tr").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/);
  await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Propostas e contratos" })).toBeVisible();
  await page.goto("/clientes?status=sem");
  await expect(page.getByText("Não foi possível carregar")).toHaveCount(0);
});

test("exporta o resultado filtrado em CSV no formato do Excel brasileiro", async ({ page }) => {
  await entrar(page);
  await page.goto("/registros?atalho=contratos");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /CSV/ }).click();
  const arquivo = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of arquivo) chunks.push(c as Buffer);
  const texto = Buffer.concat(chunks).toString("utf8");
  expect(texto.startsWith("﻿Nº;Ano;Cliente")).toBe(true);
  expect(texto).not.toContain("Contato"); // LGPD: exportação sem contatos
});

test("celular: abas embaixo e menu que abre e fecha com Esc", async ({ page, isMobile }) => {
  test.skip(!isMobile, "só no projeto de celular");
  await entrar(page);
  await expect(page.getByRole("navigation", { name: "Atalhos" })).toBeVisible();
  await page.getByRole("button", { name: "Mais opções" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
