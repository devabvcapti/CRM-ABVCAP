import { test, expect } from "@playwright/test";
import { loginAsQa } from "./helpers";

test.describe("contatos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar contato com cargo institucional, editar e excluir", async ({ page }) => {
    const name = `E2E Contact ${Date.now()}`;
    const renamedTo = `${name} (editado)`;

    await page.goto("/pt-BR/contacts");

    // Criar, com badge de Cargo (tag)
    await page.getByRole("button", { name: "Novo contato" }).click();
    const createDialog = page.getByRole("dialog", { name: "Novo contato" });
    await expect(createDialog).toBeVisible();
    await createDialog.locator("#full_name").fill(name);
    await createDialog.locator("#tags").fill("Palestrante");
    await createDialog.getByRole("button", { name: "Criar" }).click();
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
  });
});
