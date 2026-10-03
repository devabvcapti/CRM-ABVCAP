import { test, expect } from "@playwright/test";
import { loginAsQa, deleteRowIfExists, forceClick } from "./helpers";

const ORGANIZATIONS_PATH = "/pt-BR/organizations";
const CONTACTS_PATH = "/pt-BR/contacts";

test.describe("vínculo organização↔contato e timeline de interações", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("vincular um contato à organização e registrar uma interação, a partir do detalhe da organização", async ({
    page,
  }) => {
    const orgName = `E2E OrgContactLink ${Date.now()}`;
    const contactName = `E2E OrgContactLinkContact ${Date.now()}`;

    try {
      // Organização de apoio — criar já navega para o detalhe (mesmo padrão
      // de Contatos), onde ficam "Contatos vinculados" e a timeline.
      await page.goto(ORGANIZATIONS_PATH);
      await page.getByRole("button", { name: "Nova organização" }).click();
      const orgDialog = page.getByRole("dialog", { name: "Nova organização" });
      await orgDialog.locator("#name").fill(orgName);
      await orgDialog.locator("#org_type").click();
      await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
      await orgDialog.locator("#tier").click();
      await page.getByRole("option", { name: "B", exact: true }).click();
      await orgDialog.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      // Contato de apoio.
      await page.goto(CONTACTS_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const contactDialog = page.getByRole("dialog", { name: "Novo contato" });
      await contactDialog.locator("#full_name").fill(contactName);
      await contactDialog.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

      // Volta para o detalhe da organização e vincula o contato — mesma
      // relação organization_contacts de organization-links.spec.ts, vista
      // do outro lado (seleciona um contato, não uma organização).
      await page.goto(ORGANIZATIONS_PATH);
      // Clica no link de dentro da célula, não na célula inteira — desde a
      // migração de Organizações para EntityDataGrid (table-fixed), a <td>
      // fica mais larga que o <Link> que ela contém, e um .click() na célula
      // mira o centro da bounding box, que cai fora do link clicável.
      await page.getByRole("link", { name: orgName, exact: true }).click();
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      await page.locator("#contact_id").click();
      await page.getByRole("option", { name: contactName }).click();
      await page.locator("#role").fill("Conselheiro");
      // forceClick (ver helpers.ts): .click() normal trava só no projeto
      // mobile-chromium, bem no fim desta página alta (timeline + setores +
      // vínculos empilhados na largura mobile) — "FieldGroup intercepts
      // pointer events" indefinidamente, mesmo com o botão comprovadamente
      // clicável (document.elementFromPoint nas mesmas coordenadas aponta
      // pro próprio botão, retângulo estável, zero mutações no DOM — não é
      // layout quebrado nem overlay real, é um artefato do hit-test
      // sintético do CDP sob emulação de viewport mobile).
      await forceClick(page.getByRole("button", { name: "Vincular" }));

      const linkRow = page.getByRole("listitem").filter({ hasText: contactName });
      await expect(linkRow).toContainText("Conselheiro");
      await expect(linkRow).toContainText("atual");

      // Encerrar o vínculo: nunca some da lista, só ganha end_date.
      await linkRow.getByRole("button", { name: "Encerrar" }).click();
      await expect(linkRow).not.toContainText("atual");

      // Timeline de interações (componente compartilhado com Contatos, ver
      // src/components/shared/interactions-timeline.tsx) — registra uma
      // interação direto do detalhe da organização.
      await page.locator("#type").click();
      await page.getByRole("option", { name: "Reunião" }).click();
      await page.locator("#summary").fill("Reunião de acompanhamento trimestral");
      await page.getByRole("button", { name: "Registrar interação" }).click();

      await expect(page.getByText("Reunião de acompanhamento trimestral")).toBeVisible();
    } finally {
      await deleteRowIfExists(page, CONTACTS_PATH, contactName);
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, orgName);
    }
  });
});
