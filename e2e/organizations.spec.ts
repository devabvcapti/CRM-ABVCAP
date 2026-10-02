import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const LIST_PATH = "/pt-BR/organizations";

// Recarrega até a página mostrar o heading esperado, tentando de novo em
// vez de confiar numa única leitura — ver docs/roadmap.md 2026-10-02
// (PGRST116 intermitente em leitura logo após escrita, mitigado mas não
// eliminado pelo retry com backoff do servidor; em CI a janela da race é
// maior que local, então o teste precisa da própria resiliência).
async function reloadUntilVisible(page: Page, name: string, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    await page.reload();
    const heading = page.getByRole("heading", { name });
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) return;
  }
  // Última tentativa "de verdade" — se nem assim aparecer, deixa a asserção
  // normal falhar com a mensagem de erro padrão do Playwright.
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function fillAndSubmitCreate(page: Page, name: string) {
  await page.getByRole("button", { name: "Nova organização" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova organização" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#name").fill(name);
  await dialog.locator("#org_type").click();
  await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
  await dialog.locator("#tier").click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar" }).click();
}

test.describe("organizações", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar navega para o detalhe; editar e excluir a partir de lá", async ({ page }) => {
    const name = `E2E Org ${Date.now()}`;
    const renamedTo = `${name} (editada)`;

    try {
      await page.goto(LIST_PATH);

      // Criar: ao contrário do fluxo antigo (Lista + painel genérico), o
      // sucesso navega direto para a página de detalhe — é lá que ficam
      // contatos vinculados, timeline de interações e as ações de
      // editar/excluir (mesmo padrão de Contatos, ver contacts.spec.ts).
      await fillAndSubmitCreate(page, name);

      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await expect(page.getByText("Fundo de Private Equity")).toBeVisible();

      // Editar, a partir do detalhe.
      await page.getByRole("button", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog", { name: "Editar organização" });
      await expect(editDialog.locator("#name")).toHaveValue(name);
      await editDialog.locator("#name").fill(renamedTo);
      await editDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

      // Excluir: volta para a lista, e a organização não aparece mais lá.
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir" }).click();
      await expect(page).toHaveURL(/\/organizations$/);
      await expect(page.getByRole("cell", { name: renamedTo, exact: true })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, LIST_PATH, renamedTo);
      await deleteRowIfExists(page, LIST_PATH, name);
    }
  });

  test("busca por nome filtra a lista", async ({ page }) => {
    const nameA = `E2E Org Search A ${Date.now()}`;
    const nameB = `E2E Org Search B ${Date.now()}`;

    try {
      for (const name of [nameA, nameB]) {
        await page.goto(LIST_PATH);
        await fillAndSubmitCreate(page, name);
        await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);
      }

      await page.goto(LIST_PATH);
      await page.getByPlaceholder("Buscar por nome…").fill("Search A");

      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
    }
  });

  test("editar duas vezes seguidas a partir do detalhe fecha o Sheet nas duas vezes", async ({
    page,
  }) => {
    // Regressão equivalente à de Contatos (ver skill 08-testing-quality.md):
    // reabrir o Sheet de edição sem remontar o form via nonce deixa o
    // useActionState preso em success=true a partir da segunda edição.
    // Timeout maior que o padrão: reloadUntilVisible pode precisar de várias
    // tentativas reais (não só asserções que já têm retry embutido) para
    // cobrir a janela de PGRST116 em CI — sem isso, o próprio retry de
    // reload consome o orçamento do teste antes de chegar na segunda
    // edição (ver docs/roadmap.md 2026-10-02).
    test.setTimeout(60000);
    const name = `E2E Org Edit Twice ${Date.now()}`;
    const renamedOnce = `${name} (v2)`;
    const renamedTwice = `${name} (v3)`;

    try {
      await page.goto(LIST_PATH);
      await fillAndSubmitCreate(page, name);
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      await page.getByRole("button", { name: "Editar" }).click();
      const firstEditDialog = page.getByRole("dialog", { name: "Editar organização" });
      await expect(firstEditDialog.locator("#name")).toHaveValue(name);
      await firstEditDialog.locator("#name").fill(renamedOnce);
      await firstEditDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(firstEditDialog).toBeHidden();
      await expect(page.getByRole("heading", { name: renamedOnce })).toBeVisible();
      // Recarrega (com retry — ver reloadUntilVisible) antes do segundo
      // edit, em vez de depender do refresh client-side automático do
      // Server Action — mitigação para o PGRST116 intermitente (leitura
      // logo após escrita), documentado em docs/roadmap.md 2026-10-02.
      await reloadUntilVisible(page, renamedOnce);

      await page.getByRole("button", { name: "Editar" }).click();
      const secondEditDialog = page.getByRole("dialog", { name: "Editar organização" });
      await expect(secondEditDialog.locator("#name")).toHaveValue(renamedOnce);
      await secondEditDialog.locator("#name").fill(renamedTwice);
      await secondEditDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(secondEditDialog).toBeHidden();
      await expect(page.getByRole("heading", { name: renamedTwice })).toBeVisible();
    } finally {
      await deleteRowIfExists(page, LIST_PATH, renamedTwice);
      await deleteRowIfExists(page, LIST_PATH, renamedOnce);
      await deleteRowIfExists(page, LIST_PATH, name);
    }
  });
});
