import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists, forceClick, createContactViaQuickForm } from "./helpers";

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
    const stamp = Date.now();
    const orgNameA = `E2E LinkOrg A ${stamp}`;
    const orgNameB = `E2E LinkOrg B ${stamp}`;
    const contactName = `E2E LinkContact ${stamp}`;
    // Organização só pra satisfazer o campo obrigatório de Empresa do
    // cadastro rápido de Contato (Task 1) — nunca referenciada por nenhuma
    // asserção deste teste. Precisa ser DIFERENTE de orgNameA/orgNameB: o
    // teste vincula o contato de apoio a AMBAS explicitamente logo abaixo, e
    // se o cadastro rápido já tivesse criado um vínculo automático com
    // qualquer uma das duas, o vínculo manual subsequente criaria um
    // SEGUNDO vínculo pro mesmo par (contato, organização) — linkRowA/
    // linkRowB (filtro por nome de organização na lista de "Vínculos
    // institucionais" do contato) bateriam em 2 elementos cada, strict mode
    // violation no Playwright.
    const supportOrgName = `E2E LinkOrg Apoio ${stamp}`;

    try {
      await createOrganization(page, orgNameA);
      await createOrganization(page, orgNameB);
      await createOrganization(page, supportOrgName);

      // Contato de apoio — cadastro rápido (Task 1: 5 campos obrigatórios,
      // Empresa inclusa) — criar já navega para a página de detalhe, onde
      // vive a seção "Vínculos institucionais" (não fica mais dentro do
      // painel de editar).
      await createContactViaQuickForm(page, {
        name: contactName,
        title: "Analista",
        email: "contato-linkcontact@example.com",
        phone: "11999990000",
        orgName: supportOrgName,
      });
      await expect(page.getByRole("heading", { name: contactName })).toBeVisible();

      // Vincular a DUAS organizações seguidas, sem recarregar a página — é
      // exatamente o cenário que pegou o form de vínculo preso
      // (useActionState + Select da Base UI não limpam sozinhos num
      // form.reset() nativo; achado em code review).
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgNameA }).click();
      await page.locator("#role").fill("Conselheiro");
      // forceClick (ver helpers.ts): no projeto mobile-chromium, um .click()
      // normal pode travar indefinidamente num botão genuinamente clicável
      // perto do fim desta página (artefato de hit-test sob emulação de
      // viewport mobile, não um bug de produto — mesmo achado documentado em
      // ai-context/skills/04-ui-design-system.md).
      await forceClick(page.getByRole("button", { name: "Vincular" }));

      const linkRowA = page.getByRole("listitem").filter({ hasText: orgNameA });
      await expect(linkRowA).toContainText("Conselheiro");
      await expect(linkRowA).toContainText("atual");

      // Segundo vínculo: o Select precisa estar livre de novo (não travado
      // em orgNameA) para conseguir escolher orgNameB.
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgNameB }).click();
      await page.locator("#role").fill("Representante");
      await forceClick(page.getByRole("button", { name: "Vincular" }));

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
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, supportOrgName);
    }
  });
});
