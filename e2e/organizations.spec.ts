import { test, expect } from "@playwright/test";
import { loginAsQa } from "./helpers";

test.describe("organizações", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar, editar e excluir uma organização", async ({ page }) => {
    const name = `E2E Org ${Date.now()}`;
    const renamedTo = `${name} (editada)`;

    await page.goto("/pt-BR/organizations");

    // Criar
    await page.getByRole("button", { name: "Nova organização" }).click();
    const createDialog = page.getByRole("dialog", { name: "Nova organização" });
    await expect(createDialog).toBeVisible();
    await createDialog.locator("#name").fill(name);
    await createDialog.locator("#org_type").click();
    await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
    await createDialog.locator("#tier").click();
    await page.getByRole("option", { name: "B", exact: true }).click();
    await createDialog.getByRole("button", { name: "Criar" }).click();
    await expect(createDialog).toBeHidden();

    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

    // Editar
    const row = page.getByRole("row", { name });
    await row.getByRole("button", { name: "Editar" }).click();
    const editDialog = page.getByRole("dialog", { name: "Editar organização" });
    // espera o Sheet abrir com os dados originais antes de digitar — editar
    // às pressas durante a transição de abertura foi a causa real de um
    // flake aqui (o input ainda mostrava o nome antigo na falha).
    await expect(editDialog.locator("#name")).toHaveValue(name);
    await editDialog.locator("#name").fill(renamedTo);
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
  });
});
