import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists, filterList } from "./helpers";

const LIST_PATH = "/pt-BR/contacts";
const ORG_LIST_PATH = "/pt-BR/organizations";

// Best-effort, mesmo espírito de deleteRowIfExists (helpers.ts): não falha o
// teste se o filtro já não existir (ex.: o próprio teste já apagou). Mesmo
// padrão local de organizations.spec.ts (Task 2) — não promovido pra
// helpers.ts porque é específico do fluxo de filtros salvos, usado só nos
// dois specs de lista.
async function deleteSavedFilterIfExists(page: Page, name: string) {
  try {
    const item = page.getByRole("listitem").filter({ hasText: name });
    if ((await item.count()) === 0) return;
    page.once("dialog", (dialog) => dialog.accept());
    await item.getByRole("button").click();
  } catch (error) {
    console.warn(`deleteSavedFilterIfExists: limpeza de "${name}" falhou`, error);
  }
}

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
      const detailUrl = page.url();
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await expect(page.getByText("Palestrante")).toBeVisible();

      // A tag "Palestrante" cadastrada na criação também aparece como badge
      // na linha da lista, não só na página de detalhe. Filtra pelo nome
      // único do contato antes de checar a linha — a lista pagina
      // client-side (EntityDataGrid, pageSize 10) e sem o filtro a linha
      // poderia cair numa página 2+ se a conta QA compartilhada já tiver 10+
      // contatos ordenando antes dele (mesmo cuidado do teste de ordenação
      // logo abaixo).
      await page.goto(LIST_PATH);
      await page.getByPlaceholder("Buscar por nome…").fill(name);
      await expect(
        page.getByRole("row", { name }).getByText("Palestrante"),
      ).toBeVisible();
      await page.goto(detailUrl);

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
      // Filtra antes de checar a ausência — sem isso, a lista paginada
      // (EntityDataGrid, pageSize 10) pode só não ter a linha na página 1 por
      // volume de dados, mascarando uma falha real de exclusão como sucesso.
      await filterList(page, renamedTo);
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

      // Ordenação pelo cabeçalho "Nome": restringe a busca ao prefixo comum
      // aos dois contatos de teste (evita que a paginação sobre a lista
      // completa de contatos reais separe nameA/nameB em páginas diferentes),
      // clica duas vezes no cabeçalho e confirma que a segunda ordem inverte
      // a primeira (mais simples e robusto que fixar qual é "asc"/"desc").
      await page.getByPlaceholder("Buscar por nome…").fill("E2E Contact Search");
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

  test("filtros de cargo/empresa combinam em AND; filtros salvos detectam nome duplicado e podem ser reaplicados/apagados", async ({
    page,
  }) => {
    const stamp = Date.now();
    const prefix = `E2E Contact Filters ${stamp}`;
    const nameA = `${prefix} A`;
    const nameB = `${prefix} B`;
    const nameC = `${prefix} C`;
    const orgName = `E2E Org For Contact Filters ${stamp}`;
    const tagValue = `E2E Tag ${stamp}`;
    const otherTagValue = `E2E Tag Other ${stamp}`;
    const filterName = `E2E Filtro Contato ${stamp}`;

    try {
      // Organização usada como critério de Empresa — criada antes dos
      // contatos, pra já existir no Select de vínculo institucional.
      await page.goto(ORG_LIST_PATH);
      await page.getByRole("button", { name: "Nova organização" }).click();
      const orgDialog = page.getByRole("dialog", { name: "Nova organização" });
      await orgDialog.locator("#name").fill(orgName);
      await orgDialog.locator("#org_type").click();
      await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
      await orgDialog.locator("#tier").click();
      await page.getByRole("option", { name: "B", exact: true }).click();
      await orgDialog.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      // nameA: Cargo=tagValue + vínculo institucional atual com orgName —
      // bate os dois critérios.
      await page.goto(LIST_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const dialogA = page.getByRole("dialog", { name: "Novo contato" });
      await dialogA.locator("#full_name").fill(nameA);
      await dialogA.locator("#tags").fill(tagValue);
      await dialogA.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgName }).click();
      await page.locator("#role").fill("Conselheiro");
      await page.getByRole("button", { name: "Vincular" }).click();
      // getByText(orgName) sozinho bate em DOIS elementos depois do vínculo
      // criado (o valor ainda mostrado no trigger do Select #org_id + a
      // linha nova na lista de vínculos) — strict-mode violation do
      // Playwright. Escopar pro listitem, mesmo padrão de
      // organization-links.spec.ts.
      const linkRowA = page.getByRole("listitem").filter({ hasText: orgName });
      await expect(linkRowA).toContainText("Conselheiro");
      await expect(linkRowA).toContainText("atual");

      // nameB: mesmo Cargo=tagValue, SEM nenhum vínculo institucional — bate
      // só o critério de Cargo. Review Focus do brief (Step 3): prova que o
      // filtro de Empresa exclui quem não tem vínculo atual (organizationByContact
      // não tem entrada pra esse contato) sem quebrar a tela.
      await page.goto(LIST_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const dialogB = page.getByRole("dialog", { name: "Novo contato" });
      await dialogB.locator("#full_name").fill(nameB);
      await dialogB.locator("#tags").fill(tagValue);
      await dialogB.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

      // nameC: Cargo diferente (otherTagValue) + vínculo com orgName — bate
      // só o critério de Empresa. Junto com nameA/nameB, prova que os dois
      // critérios valem ao mesmo tempo (AND), não só o último aplicado.
      await page.goto(LIST_PATH);
      await page.getByRole("button", { name: "Novo contato" }).click();
      const dialogC = page.getByRole("dialog", { name: "Novo contato" });
      await dialogC.locator("#full_name").fill(nameC);
      await dialogC.locator("#tags").fill(otherTagValue);
      await dialogC.getByRole("button", { name: "Criar" }).click();
      await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
      await page.locator("#org_id").click();
      await page.getByRole("option", { name: orgName }).click();
      await page.locator("#role").fill("Conselheiro");
      await page.getByRole("button", { name: "Vincular" }).click();
      // Mesma ambiguidade de locator do vínculo de nameA acima — escopar
      // pro listitem em vez do getByText(orgName) solto.
      const linkRowC = page.getByRole("listitem").filter({ hasText: orgName });
      await expect(linkRowC).toContainText("Conselheiro");
      await expect(linkRowC).toContainText("atual");

      await page.goto(LIST_PATH);
      const searchInput = page.getByPlaceholder("Buscar por nome…");
      await searchInput.fill(prefix);
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

      // Step 1: só o Cargo (tagValue) — nameA/nameB batem; nameC (Cargo
      // diferente) não aparece.
      await page.locator("#contact-tag-filter").click();
      await page.getByRole("option", { name: tagValue, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      // Step 2: soma a Empresa (orgName), com o Cargo ainda selecionado —
      // só nameA sobra. nameB tem o Cargo certo mas nenhum vínculo
      // institucional atual (a Empresa ativa o exclui sem quebrar a tela);
      // nameC tem o vínculo com orgName mas o Cargo errado.
      await page.locator("#contact-company-filter").click();
      await page.getByRole("option", { name: orgName, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      // Step 4a: salva o filtro atual (busca=prefix + cargo + empresa) com
      // nome único.
      await page.getByRole("button", { name: "Salvar filtro atual" }).click();
      const saveDialog = page.getByRole("dialog", { name: "Salvar filtro" });
      await expect(saveDialog).toBeVisible();
      await saveDialog.locator("#name").fill(filterName);
      await saveDialog.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(saveDialog).toBeHidden();
      await expect(page.getByText(filterName, { exact: true })).toHaveCount(1);

      // Step 4b: salvar outro filtro com o MESMO nome — mensagem de erro
      // visível, e ainda só UM filtro salvo com esse nome.
      await page.getByRole("button", { name: "Salvar filtro atual" }).click();
      const duplicateDialog = page.getByRole("dialog", { name: "Salvar filtro" });
      await expect(duplicateDialog).toBeVisible();
      await duplicateDialog.locator("#name").fill(filterName);
      await duplicateDialog.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(
        duplicateDialog.getByText("Você já tem um filtro salvo com esse nome."),
      ).toBeVisible();
      await duplicateDialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(duplicateDialog).toBeHidden();
      await expect(page.getByText(filterName, { exact: true })).toHaveCount(1);

      // Step 4c: limpa busca/Cargo/Empresa — volta pro estado "mostrar
      // tudo", onde os 3 contatos de teste aparecem juntos (nenhuma
      // asserção de AUSÊNCIA aqui: limpar todos os filtros não exclui
      // ninguém por definição, é exatamente o bug invertido do round de
      // fix da Task 2 que este teste evita repetir). Depois reaplica o
      // filtro salvo — os valores voltam exatamente como estavam.
      await page.locator("#contact-tag-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await page.locator("#contact-company-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();
      await searchInput.fill("");

      await page.locator("#saved-filters-apply").click();
      await page.getByRole("option", { name: filterName }).click();
      await expect(searchInput).toHaveValue(prefix);
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      // Step 4d: apaga o filtro salvo — confirma (window.confirm mockado,
      // mesmo padrão de deleteRowIfExists em helpers.ts) que some do
      // SavedFiltersControl.
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("listitem")
        .filter({ hasText: filterName })
        .getByRole("button")
        .click();
      await expect(page.getByText(filterName, { exact: true })).toHaveCount(0);
    } finally {
      await deleteSavedFilterIfExists(page, filterName);
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
      await deleteRowIfExists(page, LIST_PATH, nameC);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });
});
