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

// Cadastro rápido (ContactCreateForm, Task 1): 5 campos obrigatórios, sempre
// os mesmos passos — extraído aqui pra não repetir em cada teste. Navega pra
// LIST_PATH, abre o Sheet, preenche e clica "Criar", mas NÃO espera a
// navegação pro detalhe (quem chama decide o que checar depois, já que o
// teste de validação (Step 13, campo obrigatório vazio) propositalmente não
// navega).
async function fillQuickCreateForm(
  page: Page,
  fields: { name?: string; title?: string; email?: string; phone?: string; orgName?: string },
) {
  await page.getByRole("button", { name: "Novo contato" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo contato" });
  if (fields.name !== undefined) await dialog.locator("#full_name").fill(fields.name);
  if (fields.title !== undefined) await dialog.locator("#title").fill(fields.title);
  if (fields.email !== undefined) await dialog.locator("#email").fill(fields.email);
  if (fields.phone !== undefined) await dialog.locator("#phone").fill(fields.phone);
  if (fields.orgName !== undefined) {
    await dialog.locator("#org_id").click();
    await page.getByRole("option", { name: fields.orgName }).click();
  }
  return dialog;
}

async function createContactViaQuickForm(
  page: Page,
  fields: { name: string; title: string; email: string; phone: string; orgName: string },
) {
  await page.goto(LIST_PATH);
  const dialog = await fillQuickCreateForm(page, fields);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
  return page.url();
}

async function createOrg(page: Page, orgName: string) {
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
}

test.describe("contatos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("cadastro rápido cria contato + vínculo institucional; editar e excluir a partir do detalhe", async ({
    page,
  }) => {
    const stamp = Date.now();
    const name = `E2E Contact ${stamp}`;
    const renamedTo = `${name} (editado)`;
    const titleValue = `Diretor de Investimentos ${stamp}`;
    const orgName = `E2E Org For Contact ${stamp}`;

    try {
      // Organização usada pelo <Select> de Empresa do cadastro rápido —
      // precisa existir antes (nunca autocomplete com criação inline, spec
      // "Fora de escopo").
      await createOrg(page, orgName);

      // Cadastro rápido: 5 campos (Nome, Cargo, E-mail, Telefone, Empresa) —
      // ao contrário de Organizações, aqui o sucesso navega direto para a
      // página de detalhe (é lá que ficam vínculos, timeline e as ações de
      // editar/excluir) — não fica na lista.
      const detailUrl = await createContactViaQuickForm(page, {
        name,
        title: titleValue,
        email: "contato@example.com",
        phone: "11999990000",
        orgName,
      });

      await expect(page.getByRole("heading", { name })).toBeVisible();
      // Cargo aparece como texto simples no header, não mais como badge
      // (match exato: o mesmo valor também aparece dentro da linha de
      // vínculo institucional abaixo, mas lá nunca sozinho — ver o
      // `role · start – end` de organization-links.tsx — então exact:true
      // aqui só bate no <p> do header).
      await expect(page.getByText(titleValue, { exact: true })).toBeVisible();

      // Review Focus: cadastro rápido cria o vínculo institucional de
      // verdade (organization_contacts), não um campo leve paralelo — a
      // organização escolhida já aparece na seção de vínculos, com role =
      // Cargo e sem precisar de nenhum passo manual extra.
      const linkRow = page.getByRole("listitem").filter({ hasText: orgName });
      await expect(linkRow).toContainText(titleValue);
      await expect(linkRow).toContainText("atual");

      // O Cargo cadastrado também aparece na coluna da lista (texto, não
      // badge).
      await page.goto(LIST_PATH);
      await page.getByPlaceholder("Buscar por nome…").fill(name);
      await expect(
        page.getByRole("row", { name }).getByText(titleValue, { exact: true }),
      ).toBeVisible();
      await page.goto(detailUrl);

      // Editar, a partir do detalhe.
      await page.getByRole("button", { name: "Editar" }).click();
      const editDialog = page.getByRole("dialog", { name: "Editar contato" });
      await expect(editDialog.locator("#full_name")).toHaveValue(name);
      await expect(editDialog.locator("#title")).toHaveValue(titleValue);

      // Review Focus (remoção completa): Idiomas e LinkedIn não existem mais
      // em lugar nenhum do form de editar — nem como campo renomeado, nem
      // escondido.
      await expect(editDialog.getByLabel("Idiomas")).toHaveCount(0);
      await expect(editDialog.getByLabel("LinkedIn")).toHaveCount(0);

      // Renomeia e também limpa o Cargo (pra checar a seguir que um Cargo
      // null não quebra nem vira a palavra "null" na lista).
      await editDialog.locator("#full_name").fill(renamedTo);
      await editDialog.locator("#title").fill("");
      await editDialog.getByRole("button", { name: "Salvar" }).click();
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

      // Idiomas/LinkedIn também não aparecem mais no detalhe (nunca
      // apareceram como rótulo solto fora do form, mas confirma que a seção
      // da barra lateral não ressuscitou os campos removidos).
      await expect(page.getByText("Idiomas", { exact: true })).toHaveCount(0);
      await expect(page.getByText("LinkedIn", { exact: true })).toHaveCount(0);

      // Review Focus (Cargo vazio): a coluna da lista mostra "—", nunca a
      // palavra "null".
      await page.goto(LIST_PATH);
      await page.getByPlaceholder("Buscar por nome…").fill(renamedTo);
      const renamedRow = page.getByRole("row", { name: renamedTo });
      await expect(renamedRow.getByText("—", { exact: true })).toBeVisible();
      await expect(renamedRow).not.toContainText("null");
      await page.goto(detailUrl);

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
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  test("cadastro rápido bloqueia submit com campo obrigatório vazio", async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Contact Required ${stamp}`;
    const orgName = `E2E Org For Contact Required ${stamp}`;

    try {
      await createOrg(page, orgName);

      // Review Focus: campo obrigatório vazio (Telefone) — o form bloqueia o
      // submit com erro visível, nunca cria um contato pela metade.
      await page.goto(LIST_PATH);
      const dialog = await fillQuickCreateForm(page, {
        name,
        title: "Analista",
        email: "contato-required@example.com",
        orgName,
        // phone propositalmente não preenchido.
      });
      await dialog.getByRole("button", { name: "Criar" }).click();

      await expect(dialog.getByText("Informe o telefone.")).toBeVisible();
      await expect(page).not.toHaveURL(/\/contacts\/[0-9a-f-]+$/);

      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await filterList(page, name);
      await expect(page.getByRole("cell", { name, exact: true })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, LIST_PATH, name);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  test("busca por nome filtra a lista", async ({ page }) => {
    const stamp = Date.now();
    const nameA = `E2E Contact Search A ${stamp}`;
    const nameB = `E2E Contact Search B ${stamp}`;
    const orgName = `E2E Org For Contact Search ${stamp}`;

    try {
      await createOrg(page, orgName);

      // Cria dois contatos (cada criação navega pro detalhe — volta à lista
      // manualmente entre uma e outra, já que não há mais "criar em sequência"
      // no fluxo de Contatos).
      for (const name of [nameA, nameB]) {
        await createContactViaQuickForm(page, {
          name,
          title: "Analista",
          email: "contato-search@example.com",
          phone: "11999990000",
          orgName,
        });
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
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  // Nota (Task 1): esta suíte testava "Cargo" (hoje `title`) e "Empresa"
  // combinados em AND no filtro da lista. A dimensão de Cargo usava o campo
  // livre de tags do cadastro rápido antigo (`#tags`) pra popular
  // `tagsByContact`/`#contact-tag-filter` — esse campo não existe mais (Cargo
  // virou `contacts.title`, um valor único, não uma tag) e, depois desta
  // task, NENHUMA tela ainda escreve em `entity_tags` para contatos (o picker
  // de Tags de verdade só chega na Task 2, no detalhe do contato) — não há
  // como popular `#contact-tag-filter` com um valor novo e isolado por este
  // teste. O teste foi reduzido para só o filtro de Empresa (dimensão que
  // continua inalterada, via `organization_contacts`) combinado com a busca
  // por nome — mantém a cobertura de "dois critérios em AND" e toda a parte
  // de filtros salvos (duplicidade de nome, reaplicar, apagar). Revisitar a
  // combinação com `#contact-tag-filter` quando a Task 2 (picker de Tags)
  // estiver no ar.
  test("filtro de empresa combina com a busca em AND; filtros salvos detectam nome duplicado e podem ser reaplicados/apagados", async ({
    page,
  }) => {
    const stamp = Date.now();
    const prefix = `E2E Contact Filters ${stamp}`;
    const nameA = `${prefix} A`;
    const nameB = `${prefix} B`;
    const nameC = `${prefix} C`;
    const orgName = `E2E Org For Contact Filters ${stamp}`;
    const otherOrgName = `E2E Org For Contact Filters Other ${stamp}`;
    const filterName = `E2E Filtro Contato ${stamp}`;

    try {
      // orgName: critério de Empresa usado no filtro. otherOrgName: só
      // existe pra dar um valor de Empresa a nameB (o cadastro rápido agora
      // exige uma Empresa pra todo contato — não dá mais pra criar um
      // contato "sem vínculo nenhum" por essa tela) que PRECISA não bater
      // com o filtro de orgName.
      await createOrg(page, orgName);
      await createOrg(page, otherOrgName);

      // nameA/nameC: vínculo com orgName — batem o filtro de Empresa.
      // nameB: vínculo com otherOrgName — não bate.
      await createContactViaQuickForm(page, {
        name: nameA,
        title: "Conselheiro",
        email: "contato-filters-a@example.com",
        phone: "11999990001",
        orgName,
      });
      await createContactViaQuickForm(page, {
        name: nameB,
        title: "Conselheiro",
        email: "contato-filters-b@example.com",
        phone: "11999990002",
        orgName: otherOrgName,
      });
      await createContactViaQuickForm(page, {
        name: nameC,
        title: "Conselheiro",
        email: "contato-filters-c@example.com",
        phone: "11999990003",
        orgName,
      });

      await page.goto(LIST_PATH);
      const searchInput = page.getByPlaceholder("Buscar por nome…");
      await searchInput.fill(prefix);
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

      // Busca por nome (prefix) + filtro de Empresa (orgName) combinados em
      // AND — nameA/nameC batem os dois critérios; nameB bate a busca mas não
      // a Empresa (vínculo com otherOrgName), e some da lista sem quebrar a
      // tela.
      await page.locator("#contact-company-filter").click();
      await page.getByRole("option", { name: orgName, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

      // Step 4a: salva o filtro atual (busca=prefix + empresa=orgName) com
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

      // Step 4c: limpa busca/Empresa — volta pro estado "mostrar tudo", onde
      // os 3 contatos de teste aparecem juntos (nenhuma asserção de AUSÊNCIA
      // aqui: limpar todos os filtros não exclui ninguém por definição).
      // Depois reaplica o filtro salvo — os valores voltam exatamente como
      // estavam.
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
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

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
      await deleteRowIfExists(page, ORG_LIST_PATH, otherOrgName);
    }
  });
});
