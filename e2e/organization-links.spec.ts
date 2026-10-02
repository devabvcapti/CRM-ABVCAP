import { test, expect } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const ORGANIZATIONS_PATH = "/pt-BR/organizations";
const CONTACTS_PATH = "/pt-BR/contacts";

test.describe("vínculo contato↔organização", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("vincular um contato a uma organização e depois encerrar o vínculo", async ({ page }) => {
    const orgName = `E2E LinkOrg ${Date.now()}`;
    const contactName = `E2E LinkContact ${Date.now()}`;

    try {
      // Organização de apoio para o vínculo.
      await page.goto(ORGANIZATIONS_PATH);
      await page.getByRole("button", { name: "Nova organização" }).click();
      const orgDialog = page.getByRole("dialog", { name: "Nova organização" });
      await orgDialog.locator("#name").fill(orgName);
      await orgDialog.locator("#org_type").click();
      await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
      await orgDialog.locator("#tier").click();
      await page.getByRole("option", { name: "B", exact: true }).click();
      await orgDialog.getByRole("button", { name: "Criar" }).click();
      await expect(orgDialog).toBeHidden();

      // Contato de apoio.
      await page.goto(CONTACTS_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const contactCreateDialog = page.getByRole("dialog", { name: "Novo contato" });
      await contactCreateDialog.locator("#full_name").fill(contactName);
      await contactCreateDialog.getByRole("button", { name: "Criar" }).click();
      await expect(contactCreateDialog).toBeHidden();

      // Reabre o contato para editar e vincular à organização.
      await page.getByRole("row", { name: contactName }).getByRole("button", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog", { name: "Editar contato" });
      await expect(editDialog.locator("#full_name")).toHaveValue(contactName);

      await editDialog.locator("#org_id").click();
      await page.getByRole("option", { name: orgName }).click();
      await editDialog.locator("#role").fill("Conselheiro");
      await editDialog.getByRole("button", { name: "Vincular" }).click();

      const linkRow = editDialog.getByText(orgName).locator("..");
      await expect(linkRow).toContainText("Conselheiro");
      await expect(linkRow).toContainText("atual");

      // Encerrar o vínculo: nunca some da lista, só ganha end_date (histórico
      // preservado — organization_contacts nunca tem DELETE na RLS).
      await editDialog.getByRole("button", { name: "Encerrar" }).click();
      await expect(linkRow).not.toContainText("atual");

      await editDialog.getByRole("button", { name: "Cancelar" }).click();
    } finally {
      await deleteRowIfExists(page, CONTACTS_PATH, contactName);
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, orgName);
    }
  });
});
