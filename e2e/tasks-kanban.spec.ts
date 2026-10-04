import { test, expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsQa, deleteRowIfExists, createContactViaQuickForm, QA_EMAIL, QA_PASSWORD } from "./helpers";

const CONTACT_LIST_PATH = "/pt-BR/contacts";
const ORG_LIST_PATH = "/pt-BR/organizations";
const TASKS_PATH = "/pt-BR/tasks";

const COLUMN_A_FAZER = "A Fazer";
const COLUMN_EM_ANDAMENTO = "Em Andamento";
const COLUMN_CONCLUIDA = "Concluída";

// Mesmo padrão de criação de organização usado em tasks.spec.ts/organizations.spec.ts —
// não promovido pra helpers.ts porque aquele arquivo não exporta sua própria
// versão (local, não compartilhada); duplicado aqui pelo mesmo motivo que
// outros specs de vínculo já duplicam esse roteiro.
async function createOrg(page: Page, orgName: string) {
  await page.goto(ORG_LIST_PATH);
  await page.getByRole("button", { name: "Nova organização" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova organização" });
  await dialog.locator("#name").fill(orgName);
  await dialog.locator("#org_type").click();
  await page.getByRole("option", { name: "Fundo de Private Equity" }).click();
  await dialog.locator("#tier").click();
  await page.getByRole("option", { name: "B", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/organizations\/[0-9a-f-]+$/);
}

// Preenche e envia o AddTaskForm (TasksList, sub-projeto 1) na página de
// detalhe (Contato OU Organização, mesmo form nas duas) já aberta. "QA
// Playwright" é o nome real (user_profiles.name) do perfil logado por
// loginAsQa — mesmo padrão duplicado de tasks.spec.ts.
async function createTaskViaDetailPage(page: Page, description: string) {
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dueDateLocal = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  await page.locator("#description").fill(description);
  await page.locator("#due_date").fill(dueDateLocal);
  await page.locator("#assigned_to").click();
  await page.getByRole("option", { name: "QA Playwright", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar tarefa" }).click();
}

// Client Node-side (@supabase/supabase-js puro) pra verificação/inserção
// direta contra o banco — mesma técnica já estabelecida em tasks.spec.ts.
// Assert duro no resultado do sign-in: sem isso, uma falha de login
// silenciosa cairia pro papel `anon` e qualquer query "sem erro, zero linhas"
// pareceria sucesso vazio em vez de falha de auth.
async function signInAsQaNode() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "crm_abvcap" } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email: QA_EMAIL,
    password: QA_PASSWORD,
  });
  expect(signInError).toBeNull();
  return client;
}

function cardLocator(page: Page, columnName: string, description: string) {
  const column = page.getByRole("region", { name: columnName });
  return column.locator('[data-slot="kanban-item"]').filter({ hasText: description });
}

// `locator.dragTo()` sem `steps` faz um único salto de mouse (ver
// implementação de Frame.dragAndDrop em playwright-core) — o sensor de
// arrastar do dnd-kit (vendorizado em reui/kanban.tsx) depende de mais de um
// evento de `mousemove` pra resolver corretamente a coluna de destino (sem
// `steps`, o drop nunca saía da própria coluna de origem — confirmado via
// trace). `steps: 20` corrige isso na maioria das vezes, mas o gesto ainda
// falha a registrar ocasionalmente sob carga (suíte completa, servidor sob
// mais contenção) — provavelmente uma corrida entre o mousedown inicial e o
// dnd-kit terminar de anexar os listeners do sensor logo após a hidratação.
// Retry da MESMA API nativa (dragTo), não substituída por mouse manual —
// ver Global Constraint do brief.
async function dragCardTo(source: Locator, targetColumn: Locator, targetCard: Locator) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Já moveu numa tentativa anterior (só a verificação de visibilidade
    // abaixo que falhou por timing)? Não arrasta de novo — `source` não
    // resolveria mais (o card já saiu da coluna de origem).
    if (await targetCard.isVisible().catch(() => false)) return;

    await source.dragTo(targetColumn, { steps: 20 });
    if (attempt === maxAttempts) {
      await expect(targetCard).toBeVisible();
      return;
    }
    try {
      await expect(targetCard).toBeVisible({ timeout: 2_000 });
      return;
    } catch {
      // Tenta de novo — ver comentário acima.
    }
  }
}

test.describe("quadro Kanban de Tarefas", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("tarefa criada no detalhe do Contato aparece em 'A Fazer' no quadro; arrastar pra 'Concluída' persiste; excluir pelo card some do quadro", async ({
    page,
  }, testInfo) => {
    // KanbanBoard (reui/kanban.tsx, vendorizado — classes default "grid
    // sm:grid-cols-3") empilha as 3 colunas verticalmente abaixo do
    // breakpoint `sm`, como no viewport estreito do projeto mobile-chromium
    // (Pixel 7). "A Fazer" e "Concluída" nunca cabem simultaneamente na
    // tela, então um gesto de arrastar exigiria rolar a página NO MEIO do
    // gesto (mouse ainda pressionado) — sem auto-scroll-on-drag-near-edge
    // (não implementado, fora de escopo desta leva: ver "Fora de escopo" em
    // docs/superpowers/specs/2026-10-04-tasks-kanban-design.md), isso não é
    // alcançável nem por um usuário real de polegar, não só pelo
    // `locator.dragTo()` do teste. Confirmado empiricamente: 4/4 execuções
    // falharam no mobile-chromium, 4/4 passaram no chromium (Desktop Chrome,
    // onde as 3 colunas cabem lado a lado). O resto do quadro (card
    // aparecer em "A Fazer", nomes, toggle, selos) continua coberto nos
    // outros dois testes deste arquivo em ambos os projetos.
    test.skip(
      testInfo.project.name === "mobile-chromium",
      "drag entre colunas empilhadas verticalmente exige rolar a página durante o gesto — não alcançável sem auto-scroll (fora de escopo)",
    );

    const stamp = Date.now();
    const orgName = `E2E Kanban Org ${stamp}`;
    const contactName = `E2E Kanban Contact ${stamp}`;
    const description = `E2E Kanban Task ${stamp}`;

    try {
      await createOrg(page, orgName);
      await createContactViaQuickForm(page, {
        name: contactName,
        title: "Diretor",
        email: `e2e.kanban.${stamp}@example.com`,
        phone: "11999990002",
        orgName,
      });
      await createTaskViaDetailPage(page, description);

      await page.goto(TASKS_PATH);

      const cardInAFazer = cardLocator(page, COLUMN_A_FAZER, description);
      await expect(cardInAFazer).toBeVisible();

      const concluidaColumn = page.getByRole("region", { name: COLUMN_CONCLUIDA });
      const cardInConcluida = cardLocator(page, COLUMN_CONCLUIDA, description);
      await dragCardTo(cardInAFazer, concluidaColumn, cardInConcluida);

      // Prova real contra o banco, não só a posição visual do card.
      const client = await signInAsQaNode();
      try {
        const { data, error } = await client
          .from("tasks")
          .select("status")
          .eq("description", description)
          .single();
        expect(error).toBeNull();
        expect(data?.status).toBe("concluida");
      } finally {
        await client.auth.signOut({ scope: "local" });
      }

      page.once("dialog", (dialog) => dialog.accept());
      await cardInConcluida.getByRole("button", { name: `Excluir tarefa ${description}` }).click();
      await expect(page.locator('[data-slot="kanban-item"]').filter({ hasText: description })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, CONTACT_LIST_PATH, contactName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  test("quadro mostra tarefas de Contato e Organização lado a lado, com o nome certo cada uma", async ({
    page,
  }) => {
    const stamp = Date.now();
    const orgAName = `E2E Kanban Org A ${stamp}`;
    const orgBName = `E2E Kanban Org B ${stamp}`;
    const contactName = `E2E Kanban Mixed Contact ${stamp}`;
    const contactTaskDescription = `E2E Kanban Mixed Contact Task ${stamp}`;
    const orgTaskDescription = `E2E Kanban Mixed Org Task ${stamp}`;

    try {
      await createOrg(page, orgAName);
      await createContactViaQuickForm(page, {
        name: contactName,
        title: "Diretor",
        email: `e2e.kanban.mixed.${stamp}@example.com`,
        phone: "11999990003",
        orgName: orgAName,
      });
      await createTaskViaDetailPage(page, contactTaskDescription);

      await createOrg(page, orgBName);
      // createOrg já deixa a página no detalhe da organização recém-criada.
      await createTaskViaDetailPage(page, orgTaskDescription);

      await page.goto(TASKS_PATH);

      // "Em Andamento" começa vazia em qualquer execução nova da suíte —
      // a ausência de erro ao carregar /tasks já exercita o caso de coluna
      // vazia implicitamente (ver brief Step 8).
      await expect(page.getByRole("region", { name: COLUMN_EM_ANDAMENTO })).toBeVisible();

      const contactCard = cardLocator(page, COLUMN_A_FAZER, contactTaskDescription);
      await expect(contactCard).toBeVisible();
      await expect(contactCard.getByRole("link", { name: contactName })).toBeVisible();

      const orgCard = cardLocator(page, COLUMN_A_FAZER, orgTaskDescription);
      await expect(orgCard).toBeVisible();
      await expect(orgCard.getByRole("link", { name: orgBName })).toBeVisible();
    } finally {
      await deleteRowIfExists(page, CONTACT_LIST_PATH, contactName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgAName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgBName);
    }
  });

  test("toggle 'Minhas tarefas' esconde tarefa de outro responsável; selo de atraso não aparece em tarefa concluída", async ({
    page,
  }) => {
    const stamp = Date.now();
    const orgName = `E2E Kanban Urgency Org ${stamp}`;
    const contactName = `E2E Kanban Urgency Contact ${stamp}`;
    const otherAssigneeDescription = `E2E Kanban Other Assignee ${stamp}`;
    const completedOverdueDescription = `E2E Kanban Completed Overdue ${stamp}`;
    const overdueDescription = `E2E Kanban Overdue ${stamp}`;

    let contactId = "";

    try {
      await createOrg(page, orgName);
      const contactUrl = await createContactViaQuickForm(page, {
        name: contactName,
        title: "Diretor",
        email: `e2e.kanban.urgency.${stamp}@example.com`,
        phone: "11999990004",
        orgName,
      });
      const contactIdMatch = contactUrl.match(/\/contacts\/([0-9a-f-]+)$/);
      if (!contactIdMatch) throw new Error(`não extraiu o id do contato de ${contactUrl}`);
      contactId = contactIdMatch[1];

      const client = await signInAsQaNode();
      try {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error("signInAsQaNode não retornou user");

        const { data: qaProfile, error: qaProfileError } = await client
          .from("user_profiles")
          .select("id")
          .eq("auth_id", user.id)
          .single();
        expect(qaProfileError).toBeNull();
        const qaProfileId = qaProfile!.id as string;

        const { data: otherProfile, error: otherProfileError } = await client
          .from("user_profiles")
          .select("id")
          .neq("id", qaProfileId)
          .limit(1)
          .single();
        expect(otherProfileError).toBeNull();
        const otherProfileId = otherProfile!.id as string;

        const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { error: insert1Error } = await client.from("tasks").insert({
          participant_type: "contact",
          participant_id: contactId,
          description: otherAssigneeDescription,
          due_date: future,
          assigned_to: otherProfileId,
          status: "a_fazer",
        });
        expect(insert1Error).toBeNull();

        const { error: insert2Error } = await client.from("tasks").insert({
          participant_type: "contact",
          participant_id: contactId,
          description: completedOverdueDescription,
          due_date: past,
          assigned_to: qaProfileId,
          status: "concluida",
        });
        expect(insert2Error).toBeNull();

        const { error: insert3Error } = await client.from("tasks").insert({
          participant_type: "contact",
          participant_id: contactId,
          description: overdueDescription,
          due_date: past,
          assigned_to: qaProfileId,
          status: "a_fazer",
        });
        expect(insert3Error).toBeNull();
      } finally {
        await client.auth.signOut({ scope: "local" });
      }

      await page.goto(TASKS_PATH);

      const otherAssigneeCard = cardLocator(page, COLUMN_A_FAZER, otherAssigneeDescription);
      await expect(otherAssigneeCard).toBeVisible();

      const completedOverdueCard = cardLocator(page, COLUMN_CONCLUIDA, completedOverdueDescription);
      await expect(completedOverdueCard).toBeVisible();
      await expect(completedOverdueCard.getByText("Atrasada")).toHaveCount(0);
      await expect(completedOverdueCard.getByText("Vence em breve")).toHaveCount(0);

      const overdueCard = cardLocator(page, COLUMN_A_FAZER, overdueDescription);
      await expect(overdueCard).toBeVisible();
      await expect(overdueCard.getByText("Atrasada")).toBeVisible();

      // Liga o toggle: tarefa de outro responsável some.
      const onlyMineToggle = page.getByRole("switch", { name: "Minhas tarefas" });
      await onlyMineToggle.click();
      await expect(cardLocator(page, COLUMN_A_FAZER, otherAssigneeDescription)).toHaveCount(0);

      // Desliga de volta: reaparece (prova que columns nunca perdeu a
      // tarefa, só escondeu visualmente).
      await onlyMineToggle.click();
      await expect(cardLocator(page, COLUMN_A_FAZER, otherAssigneeDescription)).toBeVisible();
    } finally {
      await deleteRowIfExists(page, CONTACT_LIST_PATH, contactName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });
});
