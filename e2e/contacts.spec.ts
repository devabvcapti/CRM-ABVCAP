import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const LIST_PATH = "/pt-BR/contacts";

async function fillAndSubmitCreate(page: Page, name: string) {
  await page.getByRole("button", { name: "Novo contato" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo contato" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#full_name").fill(name);
  await dialog.locator("#tags").fill("Palestrante");
  await dialog.getByRole("button", { name: "Criar" }).click();
  return dialog;
}

test.describe("contatos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar contato com cargo institucional, editar e excluir", async ({ page }) => {
    const name = `E2E Contact ${Date.now()}`;
    const renamedTo = `${name} (editado)`;

    try {
      await page.goto(LIST_PATH);

      const createDialog = await fillAndSubmitCreate(page, name);
      await expect(createDialog).toBeHidden();

      const row = page.getByRole("row", { name });
      await expect(row).toBeVisible();
      await expect(row.getByText("Palestrante")).toBeVisible();

      // Editar
      await row.getByRole("button", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog", { name: "Editar contato" });
      await expect(editDialog.locator("#full_name")).toHaveValue(name);
      await editDialog.locator("#full_name").fill(renamedTo);
      await editDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(editDialog).toBeHidden();

      await expect(page.getByRole("cell", { name: renamedTo, exact: true })).toBeVisible();

      // Excluir
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("row", { name: renamedTo })
        .getByRole("button", { name: "Excluir" })
        .click();

      await expect(page.getByRole("cell", { name: renamedTo, exact: true })).toHaveCount(0);
    } finally {
      // Limpeza best-effort — ver organizations.spec.ts para o porquê (não
      // existe projeto Supabase de staging separado, é o banco real).
      await deleteRowIfExists(page, LIST_PATH, renamedTo);
      await deleteRowIfExists(page, LIST_PATH, name);
    }
  });

  test("criar dois contatos seguidos fecha o Sheet nas duas vezes", async ({ page }) => {
    // Regressão: ver nota equivalente em organizations.spec.ts — o primeiro
    // fix de remount (key por identidade) não cobria duas criações seguidas.
    const nameA = `E2E Contact A ${Date.now()}`;
    const nameB = `E2E Contact B ${Date.now()}`;

    try {
      await page.goto(LIST_PATH);

      const firstDialog = await fillAndSubmitCreate(page, nameA);
      await expect(firstDialog).toBeHidden();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();

      const secondDialog = await fillAndSubmitCreate(page, nameB);
      await expect(secondDialog).toBeHidden();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
    } finally {
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
    }
  });
});
