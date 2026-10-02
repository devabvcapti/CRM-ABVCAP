import type { Page } from "@playwright/test";

// Conta de teste dedicada (papel analista) — nunca a conta real de Admin.
// Credenciais vêm de env vars (secrets do GitHub Actions em CI, exportadas
// manualmente em dev local), nunca hardcoded aqui.
export const QA_EMAIL = process.env.E2E_QA_EMAIL ?? "";
export const QA_PASSWORD = process.env.E2E_QA_PASSWORD ?? "";

export async function loginAsQa(page: Page) {
  await page.goto("/pt-BR/login");
  await page.locator("#email").fill(QA_EMAIL);
  await page.locator("#password").fill(QA_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}
