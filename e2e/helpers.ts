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

// Clique via DOM direto (sem depender da coordenada sintética do CDP) — ver
// ai-context/skills/04-ui-design-system.md: no projeto mobile-chromium, um
// .click() normal pode travar indefinidamente num botão genuinamente
// clicável, perto do fim de uma página alta (artefato de hit-test sob
// emulação de viewport, não um bug de produto).
export async function forceClick(locator: ReturnType<Page["getByRole"]>) {
  await locator.evaluate((el) => (el as HTMLElement).click());
}

// Limpeza best-effort para dados criados por um teste, independente dele ter
// passado ou falhado no meio do ciclo criar→editar→excluir (o nome pode estar
// no estado original OU renomeado quando a limpeza roda). Nunca falha o teste
// por conta própria — se a linha não existir, não faz nada — e por isso todo
// clique aqui é best-effort de verdade (try/catch): uma falha em LIMPAR não
// pode derrubar um teste cujas asserções já passaram.
export async function deleteRowIfExists(page: Page, listPath: string, name: string) {
  try {
    await page.goto(listPath);
    const row = page.getByRole("row", { name });
    if ((await row.count()) === 0) return;

    // Nem Contatos nem Organizações têm mais "Excluir" inline na linha desde a
    // reestruturação Lista→Detalhe→Editar (fica só no detalhe, ver
    // contact-edit-delete.tsx / organization-edit-delete.tsx) — o fallback
    // inline abaixo é só defensivo, caso algum padrão antigo reapareça.
    const inlineDelete = row.getByRole("button", { name: "Excluir" });
    if ((await inlineDelete.count()) > 0) {
      page.once("dialog", (dialog) => dialog.accept());
      await forceClick(inlineDelete);
      return;
    }

    await row.getByRole("link", { name }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await forceClick(page.getByRole("button", { name: "Excluir" }));
  } catch {
    // Best-effort de verdade — ver comentário acima. Dado órfão de um teste
    // falho fica para limpeza manual, não derruba a suíte.
  }
}
