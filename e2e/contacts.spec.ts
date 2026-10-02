import { test, expect } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const LIST_PATH = "/pt-BR/contacts";

test.describe("contatos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar navega para o detalhe; editar e excluir a partir de lá", async ({ page }) => {
    const name = `E2E Contact ${Date.now()}`;
    const renamedTo = `${name} (editado)`;

    try {
      await page.goto(LIST_PATH);

      // Criar: ao contrário de Organizações, aqui o sucesso navega direto
      // para a página de detalhe (é lá que ficam vínculos, timeline e as
      // ações de editar/excluir) — não fica na lista.
      await page.getByRole("button", { name: "Novo contato" }).click();
      const createDialog = page.getByRole("dialog", { name: "Novo contato" });
      await createDialog.locator("#full_name").fill(name);
      await createDialog.locator("#tags").fill("Palestrante");
      await createDialog.getByRole("button", { name: "Criar" }).click();

      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await expect(page.getByText("Palestrante")).toBeVisible();

      // Editar, a partir do detalhe.
      await page.getByRole("button", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog", { name: "Editar contato" });
      await expect(editDialog.locator("#full_name")).toHaveValue(name);
      await editDialog.locator("#full_name").fill(renamedTo);
      await editDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

      // Excluir: volta para a lista, e o contato não aparece mais lá.
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir" }).click();
      await expect(page).toHaveURL(/\/contacts$/);
      await expect(page.getByRole("cell", { name: renamedTo, exact: true })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, LIST_PATH, renamedTo);
      await deleteRowIfExists(page, LIST_PATH, name);
    }
  });

  test("busca por nome filtra a lista", async ({ page }) => {
    const nameA = `E2E Contact Search A ${Date.now()}`;
    const nameB = `E2E Contact Search B ${Date.now()}`;

    try {
      // Cria dois contatos (cada criação navega pro detalhe — volta à lista
      // manualmente entre uma e outra, já que não há mais "criar em sequência"
      // no fluxo de Contatos).
      for (const name of [nameA, nameB]) {
        await page.goto(LIST_PATH);
        await page.getByRole("button", { name: "Novo contato" }).click();
        const dialog = page.getByRole("dialog", { name: "Novo contato" });
        await dialog.locator("#full_name").fill(name);
        await dialog.getByRole("button", { name: "Criar" }).click();
        await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
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
});
