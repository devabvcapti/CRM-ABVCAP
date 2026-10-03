import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const LIST_PATH = "/pt-BR/organizations";

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

      // Ordenação pelo cabeçalho "Nome": restringe a busca ao prefixo comum
      // às duas organizações de teste (evita que a paginação sobre a lista
      // completa de organizações reais separe nameA/nameB em páginas
      // diferentes), clica duas vezes no cabeçalho e confirma que a segunda
      // ordem inverte a primeira (mesmo padrão de contacts.spec.ts).
      await page.getByPlaceholder("Buscar por nome…").fill("E2E Org Search");
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();

      const nameColumnSortButton = page
        .getByRole("columnheader", { name: "Nome" })
        .getByRole("button");

      async function rowOrder() {
        const rowTexts = await page.getByRole("row").allTextContents();
        return {
          a: rowTexts.findIndex((text) => text.includes(nameA)),
          b: rowTexts.findIndex((text) => text.includes(nameB)),
        };
      }

      await nameColumnSortButton.click();
      const firstOrder = await rowOrder();
      expect(firstOrder.a).toBeGreaterThanOrEqual(0);
      expect(firstOrder.b).toBeGreaterThanOrEqual(0);

      await nameColumnSortButton.click();
      const secondOrder = await rowOrder();
      expect(secondOrder.a).toBeGreaterThanOrEqual(0);
      expect(secondOrder.b).toBeGreaterThanOrEqual(0);

      expect(secondOrder.a < secondOrder.b).toBe(!(firstOrder.a < firstOrder.b));
    } finally {
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
    }
  });
});
