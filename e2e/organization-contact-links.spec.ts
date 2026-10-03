import { test, expect } from "@playwright/test";
import {
  loginAsQa,
  deleteRowIfExists,
  forceClick,
  filterList,
  createContactViaQuickForm,
} from "./helpers";

const ORGANIZATIONS_PATH = "/pt-BR/organizations";
const CONTACTS_PATH = "/pt-BR/contacts";

test.describe("vínculo organização↔contato e timeline de interações", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("vincular um contato à organização e registrar uma interação, a partir do detalhe da organização", async ({
    page,
  }) => {
    const stamp = Date.now();
    const orgName = `E2E OrgContactLink ${stamp}`;
    const contactName = `E2E OrgContactLinkContact ${stamp}`;
    // Organização só pra satisfazer o campo obrigatório de Empresa do
    // cadastro rápido de Contato (Task 1) — nunca referenciada por nenhuma
    // asserção deste teste. Precisa ser DIFERENTE de `orgName`: se o contato
    // de apoio já nascesse vinculado a `orgName` (a própria organização sob
    // teste), o "Vincular" manual abaixo criaria um SEGUNDO vínculo
    // (contato, orgName), e `linkRow` (filtro por `contactName` na lista de
    // "Contatos vinculados" de `orgName`) bateria em 2 elementos — strict
    // mode violation no Playwright.
    const supportOrgName = `E2E OrgContactLink Apoio ${stamp}`;

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

      // Segunda organização, só pro cadastro rápido do contato de apoio (ver
      // comentário de `supportOrgName` acima).
      await page.goto(ORGANIZATIONS_PATH);
      await page.getByRole("button", { name: "Nova organização" }).click();
      const supportOrgDialog = page.getByRole("dialog", { name: "Nova organização" });
      await supportOrgDialog.locator("#name").fill(supportOrgName);
      await supportOrgDialog.locator("#org_type").click();
      await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
      await supportOrgDialog.locator("#tier").click();
      await page.getByRole("option", { name: "B", exact: true }).click();
      await supportOrgDialog.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      // Contato de apoio — cadastro rápido (Task 1: 5 campos obrigatórios,
      // Empresa inclusa).
      await createContactViaQuickForm(page, {
        name: contactName,
        title: "Analista",
        email: "contato-orgcontactlink@example.com",
        phone: "11999990000",
        orgName: supportOrgName,
      });

      // Volta para o detalhe da organização e vincula o contato — mesma
      // relação organization_contacts de organization-links.spec.ts, vista
      // do outro lado (seleciona um contato, não uma organização).
      await page.goto(ORGANIZATIONS_PATH);
      // Filtra antes de localizar o link — a lista pagina client-side
      // (EntityDataGrid, pageSize 10, ordenada por nome), então sem o filtro
      // esta organização de teste pode cair numa página 2+ e o lookup abaixo
      // trava esperando um link que nunca aparece na página 1.
      await filterList(page, orgName);
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
      await deleteRowIfExists(page, ORGANIZATIONS_PATH, supportOrgName);
    }
  });
});
