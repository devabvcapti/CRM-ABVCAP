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
  return dialog;
}

test.describe("organizações", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("criar, editar e excluir uma organização", async ({ page }) => {
    const name = `E2E Org ${Date.now()}`;
    const renamedTo = `${name} (editada)`;

    try {
      await page.goto(LIST_PATH);

      const createDialog = await fillAndSubmitCreate(page, name);
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
    } finally {
      // Limpeza best-effort mesmo se a asserção acima falhar no meio do
      // caminho — nunca deixar "E2E Org ..." residual no banco de produção
      // (é o único projeto Supabase do time, não um staging dedicado).
      await deleteRowIfExists(page, LIST_PATH, renamedTo);
      await deleteRowIfExists(page, LIST_PATH, name);
    }
  });

  test("criar duas organizações seguidas fecha o Sheet nas duas vezes", async ({ page }) => {
    // Regressão: a primeira versão do fix de remount usava
    // key={editing?.id ?? "create"} — toda criação tem editing=undefined,
    // então duas criações seguidas caíam na MESMA key, o form não remontava,
    // e o useActionState ficava preso em success=true (o Sheet só fechava na
    // primeira vez). Achado em code review, antes de virar bug em produção.
    const nameA = `E2E Org A ${Date.now()}`;
    const nameB = `E2E Org B ${Date.now()}`;

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
