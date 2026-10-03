import { test, expect, type Page } from "@playwright/test";
import {
  loginAsQa,
  deleteRowIfExists,
  filterList,
  fillQuickCreateForm,
  createContactViaQuickForm,
} from "./helpers";

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

// `fillQuickCreateForm`/`createContactViaQuickForm` (cadastro rápido de
// Contato, 5 campos — Task 1) moraram aqui antes; promovidas pra
// `./helpers` porque `organization-contact-links.spec.ts` e `organization-
// links.spec.ts` também precisam criar um "contato de apoio" e Empresa virou
// campo obrigatório no cadastro rápido (ver helpers.ts).

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

  // Nota (Task 1, revisitada após a Task 2): esta suíte testava "Cargo" (hoje
  // `title`) e "Empresa" combinados em AND no filtro da lista. A dimensão de
  // Cargo usava o campo livre de tags do cadastro rápido antigo (`#tags`)
  // pra popular `tagsByContact`/`#contact-tag-filter` — esse campo não existe
  // mais (Cargo virou `contacts.title`, um valor único, não uma tag) e, na
  // época da Task 1, nenhuma tela ainda escrevia em `entity_tags` para
  // contatos (o picker de Tags de verdade só chegou na Task 2, no detalhe do
  // contato). O teste foi reduzido para só o filtro de Empresa, com a nota de
  // revisitar a combinação com `#contact-tag-filter` quando o picker
  // estivesse no ar. Ele está (ver `ContactTags`/`TagAddPicker` em
  // `[id]/contact-tags.tsx`) — a dimensão de Tag é restaurada abaixo, usando
  // o picker real pra anexar uma tag só a nameA antes do filtro combinado.
  test("filtro de empresa combina com a busca em AND; filtro de tag combina com Empresa em AND; filtros salvos detectam nome duplicado e podem ser reaplicados/apagados", async ({
    page,
  }) => {
    // Teste mais pesado da suíte (2 orgs + 3 contatos + anexar tag real +
    // 2 filtros em AND + 2 fluxos de diálogo de filtro salvo + limpeza de
    // 6 entidades no finally) — o timeout padrão de 30s já era apertado
    // antes da dimensão de Tag voltar (Fix 3) e estourou em CI (latência de
    // leitura-após-escrita do Supabase hospedado é maior em CI do que local,
    // visível nos warnings `fetchEntityOrNull gave up after retries` do
    // próprio log de CI, inclusive em specs não relacionados — não é bug de
    // lógica deste teste, é orçamento de tempo insuficiente pro volume real
    // de passos).
    test.setTimeout(90_000);
    const stamp = Date.now();
    const prefix = `E2E Contact Filters ${stamp}`;
    const nameA = `${prefix} A`;
    const nameB = `${prefix} B`;
    const nameC = `${prefix} C`;
    const orgName = `E2E Org For Contact Filters ${stamp}`;
    const otherOrgName = `E2E Org For Contact Filters Other ${stamp}`;
    const filterName = `E2E Filtro Contato ${stamp}`;
    // Tag única pro teste de AND com `#contact-tag-filter` (mesmo padrão de
    // nome com timestamp do teste do picker, "picker de Tags no detalhe" —
    // só nameA recebe a tag, pra distinguir de nameC, que tem a MESMA Empresa
    // mas nenhuma tag). Mesmo risco aceito daquele teste: não há tela de
    // gestão de Tags no app, então a linha criada em `tags` fica órfã no
    // banco de QA depois deste teste.
    const tagName = `E2E Contact Filters Tag ${stamp}`;

    try {
      // orgName: critério de Empresa usado no filtro. otherOrgName: só
      // existe pra dar um valor de Empresa a nameB (o cadastro rápido agora
      // exige uma Empresa pra todo contato — não dá mais pra criar um
      // contato "sem vínculo nenhum" por essa tela) que PRECISA não bater
      // com o filtro de orgName.
      await createOrg(page, orgName);
      await createOrg(page, otherOrgName);

      // nameA/nameC: vínculo com orgName — batem o filtro de Empresa.
      // nameB: vínculo com otherOrgName — não bate. Só nameA recebe a tag
      // (abaixo), então nameA e nameC seguem distinguíveis mesmo com a mesma
      // Empresa.
      const urlA = await createContactViaQuickForm(page, {
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

      // Anexa a tag só a nameA via o picker real (ContactTags) — mesmo fluxo
      // do teste "picker de Tags no detalhe": abre, digita o nome novo,
      // escolhe a opção "criar". `addTagToContact` revalida a lista
      // (`revalidateContacts`), então o próximo `page.goto(LIST_PATH)` já
      // busca `tagsByContact` atualizado e popula `#contact-tag-filter` com
      // `tagName`.
      await page.goto(urlA);
      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await page.getByPlaceholder("Buscar ou criar tag…").fill(tagName);
      await page.getByRole("option", { name: `Criar tag: "${tagName}"` }).click();
      await expect(page.getByRole("button", { name: `Remover tag ${tagName}` })).toBeVisible();

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

      // Filtro de Tag (`#contact-tag-filter`) combinado com o filtro de
      // Empresa já ativo (orgName), em AND — nameA e nameC têm a MESMA
      // Empresa, mas só nameA tem `tagName`: com os dois filtros ativos,
      // nameC precisa sumir (bate Empresa, não bate Tag) e nameA continuar
      // visível (bate os dois). Prova que o filtro de Tag não é só um filtro
      // isolado, mas combina em AND com outro critério já ativo.
      await page.locator("#contact-tag-filter").click();
      await page.getByRole("option", { name: tagName, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);
      await expect(page.getByRole("cell", { name: nameC, exact: true })).toHaveCount(0);

      // Volta o filtro de Tag para "Todos" antes de seguir — os passos de
      // filtro salvo abaixo capturam e reaplicam o estado atual (busca=prefix
      // + empresa=orgName) e não devem incluir a Tag nessa combinação.
      await page.locator("#contact-tag-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
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

  // Filtro de Cargo (`#contact-title-filter`) na lista de Contatos — busca
  // por `contacts.title` (campo novo, valor único, distinto de Tag). Teste
  // enxuto de propósito (2 contatos, sem Empresa/filtro salvo): só prova que
  // o filtro lista os valores de Cargo existentes e que filtrar por um deles
  // esconde o contato com Cargo diferente, sem reusar o teste pesado acima
  // (que já precisou de timeout estendido).
  test("filtro de Cargo na lista de Contatos filtra por título, não por tag", async ({ page }) => {
    const stamp = Date.now();
    const orgName = `E2E Org For Contact Title Filter ${stamp}`;
    const titleA = `E2E Diretor ${stamp}`;
    const titleB = `E2E Analista ${stamp}`;
    const nameA = `E2E Contact Title A ${stamp}`;
    const nameB = `E2E Contact Title B ${stamp}`;

    try {
      await createOrg(page, orgName);
      await createContactViaQuickForm(page, {
        name: nameA,
        title: titleA,
        email: "contato-title-a@example.com",
        phone: "11999990001",
        orgName,
      });
      await createContactViaQuickForm(page, {
        name: nameB,
        title: titleB,
        email: "contato-title-b@example.com",
        phone: "11999990002",
        orgName,
      });

      await page.goto(LIST_PATH);
      const searchInput = page.getByPlaceholder("Buscar por nome…");
      await searchInput.fill(`E2E Contact Title`);
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();

      await page.locator("#contact-title-filter").click();
      await page.getByRole("option", { name: titleA, exact: true }).click();
      await expect(page.getByRole("cell", { name: nameA, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toHaveCount(0);

      await page.locator("#contact-title-filter").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await expect(page.getByRole("cell", { name: nameB, exact: true })).toBeVisible();
    } finally {
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  // Task 2: picker de Tags no detalhe do Contato. Usa 3 contatos de apoio
  // (A/B/C) ligados à mesma organização: A cria a tag e depois a remove, B
  // anexa a MESMA tag digitando o nome com espaços extras (prova que o
  // upsert por nome não duplica), C nunca recebe a tag — serve só pra
  // verificar o catálogo global (se existisse um "quase-duplicado", ele
  // apareceria como uma segunda opção ao buscar pelo nome em C). Não há tela
  // de gestão de Tags no app (fora de escopo) — a linha criada em `tags`
  // fica órfã no banco de QA após o teste, mesmo risco aceito de outros
  // specs que não limpam entidades sem UI de exclusão própria.
  test("picker de Tags no detalhe: cria, não duplica por nome com espaços, remove sem apagar do catálogo", async ({
    page,
  }) => {
    const stamp = Date.now();
    const tagName = `E2E Tag ${stamp}`;
    const orgName = `E2E Org For Contact Tags ${stamp}`;
    const nameA = `E2E Contact Tags A ${stamp}`;
    const nameB = `E2E Contact Tags B ${stamp}`;
    const nameC = `E2E Contact Tags C ${stamp}`;

    try {
      await createOrg(page, orgName);

      const urlA = await createContactViaQuickForm(page, {
        name: nameA,
        title: "Conselheiro",
        email: "contato-tags-a@example.com",
        phone: "11999990001",
        orgName,
      });
      const urlB = await createContactViaQuickForm(page, {
        name: nameB,
        title: "Conselheiro",
        email: "contato-tags-b@example.com",
        phone: "11999990002",
        orgName,
      });
      const urlC = await createContactViaQuickForm(page, {
        name: nameC,
        title: "Conselheiro",
        email: "contato-tags-c@example.com",
        phone: "11999990003",
        orgName,
      });

      // --- Contato A: cria a tag nova via opção "criar".
      await page.goto(urlA);
      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await page.getByPlaceholder("Buscar ou criar tag…").fill(tagName);
      await page.getByRole("option", { name: `Criar tag: "${tagName}"` }).click();
      await expect(
        page.getByRole("button", { name: `Remover tag ${tagName}` }),
      ).toBeVisible();

      // Reabre o picker: a tag recém-anexada não pode aparecer como opção
      // (Review Focus — nunca oferecer uma tag já anexada). Confirma
      // primeiro que o picker de fato abriu (input de busca visível) antes
      // do toHaveCount(0) — sem isso, a asserção de ausência passaria
      // trivialmente mesmo que o listbox ainda nem tivesse renderizado,
      // sem provar nada (achado do code review final).
      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await expect(page.getByPlaceholder("Buscar ou criar tag…")).toBeVisible();
      await expect(page.getByRole("option", { name: tagName })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Adicionar tag" })).toBeVisible();

      // --- Contato B: digita o MESMO nome com espaços extras — o match
      // exato (trimmed) com a tag já existente faz o picker surgir com a
      // opção REGULAR (rótulo = `tagName` puro, sem prefixo "Criar tag:"),
      // nunca a opção de criar (que corretamente deixa de aparecer quando já
      // existe uma tag com esse nome exato) — precisa anexar a tag EXISTENTE
      // (mesmo id), não criar uma segunda tag quase-igual no catálogo.
      await page.goto(urlB);
      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await page.getByPlaceholder("Buscar ou criar tag…").fill(`  ${tagName}  `);
      await page.getByRole("option", { name: tagName }).click();
      await expect(
        page.getByRole("button", { name: `Remover tag ${tagName}` }),
      ).toBeVisible();

      // --- Contato C (nunca recebeu a tag): busca pelo nome no catálogo
      // inteiro — exatamente UMA opção deve bater (se B tivesse criado um
      // quase-duplicado com espaços, apareceriam duas).
      await page.goto(urlC);
      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await page.getByPlaceholder("Buscar ou criar tag…").fill(tagName);
      await expect(page.getByRole("option", { name: tagName })).toHaveCount(1);
      await page.keyboard.press("Escape");

      // --- De volta ao Contato A: remove a tag (botão de remover, sem
      // confirm — reversível) — some do contato, mas continua existindo no
      // catálogo (reabre o picker, a tag aparece de novo como opção).
      await page.goto(urlA);
      await page.getByRole("button", { name: `Remover tag ${tagName}` }).click();
      await expect(
        page.getByRole("button", { name: `Remover tag ${tagName}` }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Adicionar tag" }).click();
      await page.getByPlaceholder("Buscar ou criar tag…").fill(tagName);
      await expect(page.getByRole("option", { name: tagName })).toHaveCount(1);
    } finally {
      await deleteRowIfExists(page, LIST_PATH, nameA);
      await deleteRowIfExists(page, LIST_PATH, nameB);
      await deleteRowIfExists(page, LIST_PATH, nameC);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });
});
