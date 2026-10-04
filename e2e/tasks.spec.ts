import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsQa, deleteRowIfExists, createContactViaQuickForm, QA_EMAIL, QA_PASSWORD } from "./helpers";

const CONTACT_LIST_PATH = "/pt-BR/contacts";
const ORG_LIST_PATH = "/pt-BR/organizations";

// Mesmo padrão de criação de organização usado em organizations.spec.ts —
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

// Preenche e envia o AddTaskForm (TasksList, Task 2) na página de detalhe
// (Contato OU Organização — mesmo form nas duas) já aberta. "QA" é o nome do
// perfil logado por loginAsQa (qa@abvcap.com.br) — precisa aparecer como
// opção do <Select> de "Atribuída a" (ver assignableProfiles, sem filtro de
// papel).
async function createTask(page: Page, description: string) {
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dueDateLocal = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  await page.locator("#description").fill(description);
  await page.locator("#due_date").fill(dueDateLocal);
  await page.locator("#assigned_to").click();
  // exact: true — sem isso, a correspondência por nome acessível de
  // Playwright é substring case-insensitive, então também casaria com
  // qualquer outro perfil cujo nome contenha "qa" (improvável hoje, mas
  // barato de tornar robusto).
  await page.getByRole("option", { name: "QA", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar tarefa" }).click();
}

test.describe("tarefas", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsQa(page);
  });

  test("ciclo completo de Tarefa a partir do detalhe do Contato: criar, concluir, reabrir, excluir", async ({
    page,
  }) => {
    const stamp = Date.now();
    const orgName = `E2E Org For Task Contact ${stamp}`;
    const contactName = `E2E Contact For Task ${stamp}`;
    const description = `E2E Task ${stamp}`;

    try {
      await createOrg(page, orgName);

      await createContactViaQuickForm(page, {
        name: contactName,
        title: "Diretor",
        email: `e2e.task.${stamp}@example.com`,
        phone: "11999990000",
        orgName,
      });

      await createTask(page, description);

      const row = page.getByRole("listitem").filter({ hasText: description });
      await expect(row).toBeVisible();
      const checkbox = row.getByRole("checkbox");
      await expect(checkbox).not.toBeChecked();
      await expect(row.getByText(description)).not.toHaveClass(/line-through/);

      // Concluir.
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(row.getByText(description)).toHaveClass(/line-through/);

      // Reabrir.
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
      await expect(row.getByText(description)).not.toHaveClass(/line-through/);

      // Excluir.
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: `Excluir tarefa ${description}` }).click();
      await expect(page.getByRole("listitem").filter({ hasText: description })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, CONTACT_LIST_PATH, contactName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  test("ciclo completo de Tarefa a partir do detalhe da Organização: criar, concluir, reabrir, excluir", async ({
    page,
  }) => {
    const stamp = Date.now();
    const orgName = `E2E Org For Task Org ${stamp}`;
    const description = `E2E Task Org ${stamp}`;

    try {
      await createOrg(page, orgName);
      // createOrg já deixa a página no detalhe da organização recém-criada.

      await createTask(page, description);

      const row = page.getByRole("listitem").filter({ hasText: description });
      await expect(row).toBeVisible();
      const checkbox = row.getByRole("checkbox");
      await expect(checkbox).not.toBeChecked();

      // Concluir.
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect(row.getByText(description)).toHaveClass(/line-through/);

      // Reabrir.
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();

      // Excluir.
      page.once("dialog", (dialog) => dialog.accept());
      await row.getByRole("button", { name: `Excluir tarefa ${description}` }).click();
      await expect(page.getByRole("listitem").filter({ hasText: description })).toHaveCount(0);
    } finally {
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });

  test("excluir um Contato com tarefa pendente não deixa linha órfã", async ({ page }) => {
    const stamp = Date.now();
    const orgName = `E2E Org For Task Cleanup ${stamp}`;
    const contactName = `E2E Contact For Task Cleanup ${stamp}`;
    const description = `E2E Task Cleanup ${stamp}`;

    try {
      await createOrg(page, orgName);

      const contactUrl = await createContactViaQuickForm(page, {
        name: contactName,
        title: "Diretor",
        email: `e2e.task.cleanup.${stamp}@example.com`,
        phone: "11999990001",
        orgName,
      });
      // tasks.participant_id não tem FK real pra contacts.id (polimórfico,
      // por design — ver spec). Precisamos do uuid do contato pra
      // consultar `tasks` depois do delete; a URL do detalhe já contém.
      const contactIdMatch = contactUrl.match(/\/contacts\/([0-9a-f-]+)$/);
      if (!contactIdMatch) throw new Error(`não extraiu o id do contato de ${contactUrl}`);
      const contactId = contactIdMatch[1];

      await createTask(page, description);
      await expect(page.getByRole("listitem").filter({ hasText: description })).toBeVisible();

      // Exclui o contato a partir do detalhe (fluxo já existente de
      // ContactEditDelete/handleDelete) com a tarefa ainda pendente.
      // `exact: true` necessário aqui: sem ele, "Excluir" (botão de excluir
      // o Contato) também casa por substring com o aria-label do botão de
      // lixeira da tarefa ("Excluir tarefa {description}") — agora que a
      // tarefa criada acima deixa essa segunda linha "Excluir" na página,
      // o locator sem `exact` resolve pra 2 elementos (strict mode
      // violation). Mesmo padrão de desambiguação já usado em
      // organization-contact-links.spec.ts.
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Excluir", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${CONTACT_LIST_PATH}$`));

      // O delete do contato ter sucedido e redirecionado NÃO prova que a
      // tarefa órfã foi limpa — tasks.participant_id é polimórfico, sem FK
      // pra contacts.id, então o delete do contato teria o mesmo
      // resultado (sucesso + redirect) tanto se cleanupPolymorphicReferences
      // limpou `tasks` quanto se essa limpeza estivesse silenciosamente
      // quebrada (ex.: alguém removesse a linha de `tasks` desse helper).
      // Confirmação direta: consulta `tasks` via client Node-side
      // (@supabase/supabase-js puro, não o @supabase/ssr do browser) —
      // zero linhas restantes para esse contactId prova a limpeza de
      // verdade, não é mais evidência indireta.
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: "crm_abvcap" } },
      );
      try {
        await client.auth.signInWithPassword({ email: QA_EMAIL, password: QA_PASSWORD });
        const { data, error } = await client
          .from("tasks")
          .select("id")
          .eq("participant_type", "contact")
          .eq("participant_id", contactId);
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
      } finally {
        await client.auth.signOut();
      }
    } finally {
      await deleteRowIfExists(page, CONTACT_LIST_PATH, contactName);
      await deleteRowIfExists(page, ORG_LIST_PATH, orgName);
    }
  });
});
