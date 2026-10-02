import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists } from "./helpers";

const ORGANIZATIONS_PATH = "/pt-BR/organizations";
const CONTACTS_PATH = "/pt-BR/contacts";

async function createOrganization(page: Page, name: string) {
  await page.goto(ORGANIZATIONS_PATH);
  await page.getByRole("button", { name: "Nova organização" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova organização" });
  await dialog.locator("#name").fill(name);
  await dialog.locator("#org_type").click();
  await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
  await dialog.locator("#tier").click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("vínculo contato↔organização", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("vincular um contato a duas organizações seguidas e depois encerrar um vínculo", async ({
    page,
  }) => {
    const orgNameA = `E2E LinkOrg A ${Date.now()}`;
    const orgNameB = `E2E LinkOrg B ${Date.now()}`;
    const contactName = `E2E LinkContact ${Date.now()}`;

    try {
      await createOrganization(page, orgNameA);
      await createOrganization(page, orgNameB);

      // Contato de apoio — criar já navega para a página de detalhe, onde
      // vive a seção "Vínculos institucionais" (não fica mais dentro do
      // painel de editar).
      await page.goto(CONTACTS_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const contactCreateDialog = page.getByRole("dialog", { name: "Novo contato" });
      await contactCreateDialog.locator("#full_name").fill(contactName);
      await contactCreateDialog.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name: contactName })).toBeVisible();

      // Vincular a DUAS organizações seguidas, sem recarregar a página — é
      // exatamente o cenário que pegou o form de vínculo preso
      // (useActionState + Select da Base UI não limpam sozinhos num
      // form.reset() nativo; achado em code review).
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgNameA }).click();
      await page.locator("#role").fill("Conselheiro");
      await page.getByRole("button", { name: "Vincular" }).click();

      const linkRowA = page.getByRole("listitem").filter({ hasText: orgNameA });
      await expect(linkRowA).toContainText("Conselheiro");
      await expect(linkRowA).toContainText("atual");

      // Segundo vínculo: o Select precisa estar livre de novo (não travado
      // em orgNameA) para conseguir escolher orgNameB.
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgNameB }).click();
      await page.locator("#role").fill("Representante");
      await page.getByRole("button", { name: "Vincular" }).click();

      const linkRowB = page.getByRole("listitem").filter({ hasText: orgNameB });
      await expect(linkRowB).toContainText("Representante");
      await expect(linkRowB).toContainText("atual");
      // O primeiro vínculo precisa continuar intacto.
      await expect(linkRowA).toContainText("atual");

      // Encerrar o primeiro vínculo: nunca some da lista, só ganha end_date
      // (histórico preservado — organization_contacts nunca tem DELETE na RLS).
      await linkRowA.getByRole("button", { name: "Encerrar" }).click();
      await expect(linkRowA).not.toContainText("atual");
      await expect(linkRowB).toContainText("atual");
    } finally {
      await deleteRowIfExists(page, CONTACTS_PATH, contactName);
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, orgNameA);
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, orgNameB);
    }
  });
});
