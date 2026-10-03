import { test, expect, type Page } from "@playwright/test";
import { loginAsQa, deleteRowIfExists, filterList } from "./helpers";

const LIST_PATH = "/pt-BR/organizations";

async function fillAndSubmitCreate(page: Page, name: string, typeOptionLabel = "Fundo de Private Equity") {
  await page.getByRole("button", { name: "Nova organização" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova organização" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#name").fill(name);
  await dialog.locator("#org_type").click();
  await page.getByRole("option", { name: typeOptionLabel }).click();
  await dialog.locator("#tier").click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar" }).click();
}

// Edita status/setores a partir do detalhe (onde fillAndSubmitCreate já
// deixa a página depois de criar) — usado só pra montar um cenário com
// critérios variados pro teste de filtros combinados abaixo (o form de
// criação não expõe status/setor).
async function editStatusAndSector(
  page: Page,
  { statusOptionLabel, sector }: { statusOptionLabel?: string; sector?: string },
) {
  await page.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar organização" });
  await expect(dialog).toBeVisible();
  if (sector !== undefined) await dialog.locator("#priority_sectors").fill(sector);
  if (statusOptionLabel) {
    await dialog.locator("#status").click();
    await page.getByRole("option", { name: statusOptionLabel }).click();
  }
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
}

// Best-effort, mesmo espírito de deleteRowIfExists (helpers.ts): não falha o
// teste se o filtro já não existir (ex.: o próprio Step 7 já apagou).
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

  test("filtros de tipo/tier/status/setor combinam em AND; filtros salvos detectam nome duplicado e podem ser reaplicados/apagados", async ({
    page,
  }) => {
    const stamp = Date.now();
    const prefix = `E2E Org Filters ${stamp}`;
    const nameA = `${prefix} PE Ativo`;
    const nameB = `${prefix} VC`;
    const nameC = `${prefix} PE Inativo Setor`;
    const sector = `E2E Setor ${stamp}`;
    const filterName = `E2E Filtro ${stamp}`;

    try {
      // nameA/nameB cobrem o Tipo (PE vs VC); nameC reusa o Tipo de nameA
      // (PE) mas com Status diferente (Inativo, via editStatusAndSector —
      // o form de criação não expõe status/setor) e um Setor próprio que
      // nameA/nameB não têm (array vazio), pra exercitar os dois Review
      // Focus do Step 2/3 do brief: critérios combinados em AND e Setor
      // vazio não quebrando o filtro.
      await page.goto(LIST_PATH);
      await fillAndSubmitCreate(page, nameA, "Fundo de Private Equity");
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      await page.goto(LIST_PATH);
      await fillAndSubmitCreate(page, nameB, "Fundo de Venture Capital");
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);

      await page.goto(LIST_PATH);
      await fillAndSubmitCreate(page, nameC, "Fundo de Private Equity");
      await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);
      await editStatusAndSector(page, { statusOptionLabel: "Inativo", sector });

      await page.goto(LIST_PATH);
      const searchInput = page.getByPlaceholder("Buscar por nome…");
      await searchInput.fill(prefix);
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

      // Step 1: só o Tipo — mostra só organizações daquele tipo (nameB é
      // Fundo de VC; nameA/nameC são Fundo de PE).
      await page.locator("#org-type-filter").click();
      await page.getByRole("option", { name: "Fundo de Venture Capital" }).click();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      // Step 2: troca o Tipo pra PE (nameA e nameC batem) e, com o Tipo
      // ainda selecionado, soma o Status — só nameA (Ativo) deve sobrar;
      // nameC é Inativo. Prova que os dois critérios valem ao mesmo tempo,
      // não só o último aplicado.
      await page.locator("#org-type-filter").click();
      await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();

      await page.locator("#org-status-filter").click();
      await page.getByRole("option", { name: "Ativo", exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);

      // Step 3: limpa Tipo/Status e filtra só por Setor — nameC (que tem o
      // setor) aparece; nameA/nameB (sem nenhum setor cadastrado, array
      // vazio) não quebram o filtro nem aparecem.
      await page.locator("#org-type-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await page.locator("#org-status-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await page.locator("#org-sector-filter").click();
      await page.getByRole("option", { name: sector, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);

      // Step 4: salva o filtro atual (busca=prefix + setor) com nome único.
      await page.getByRole("button", { name: "Salvar filtro atual" }).click();
      const saveDialog = page.getByRole("dialog", { name: "Salvar filtro" });
      await expect(saveDialog).toBeVisible();
      await saveDialog.locator("#name").fill(filterName);
      await saveDialog.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(saveDialog).toBeHidden();
      await expect(page.getByText(filterName, { exact: true })).toHaveCount(1);

      // Step 5: salvar outro filtro com o MESMO nome — mensagem de erro
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

      // Step 6: limpa a busca e o Setor (Tipo/Status já estão em "Todos"
      // desde o Step 3) e reaplica o filtro salvo — os valores voltam
      // exatamente como estavam (busca=prefix, setor=sector), sem
      // reconfigurar nada manualmente.
      await searchInput.fill("");
      await page.locator("#org-sector-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      await page.locator("#saved-filters-apply").click();
      await page.getByRole("option", { name: filterName }).click();
      await expect(searchInput).toHaveValue(prefix);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);

      // Step 7: apaga o filtro salvo — confirma (window.confirm mockado,
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
    }
  });
});
