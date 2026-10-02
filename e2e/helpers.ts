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

// Limpeza best-effort para dados criados por um teste, independente dele ter
// passado ou falhado no meio do ciclo criar→editar→excluir (o nome pode estar
// no estado original OU renomeado quando a limpeza roda). Nunca falha o teste
// por conta própria — se a linha não existir, não faz nada.
export async function deleteRowIfExists(page: Page, listPath: string, name: string) {
  await page.goto(listPath);
  const row = page.getByRole("row", { name });
  if ((await row.count()) === 0) return;

  // Organizações ainda tem "Excluir" inline na linha; Contatos não (fica só
  // no detalhe, ver contact-edit-delete.tsx) — detecta qual padrão se aplica.
  const inlineDelete = row.getByRole("button", { name: "Excluir" });
  if ((await inlineDelete.count()) > 0) {
    page.once("dialog", (dialog) => dialog.accept());
    await inlineDelete.click();
    return;
  }

  await row.getByRole("link", { name }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir" }).click();
}
