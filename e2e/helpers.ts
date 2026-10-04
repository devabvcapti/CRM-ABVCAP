import { expect, type Page } from "@playwright/test";

// Conta de teste dedicada (papel analista) — nunca a conta real de Admin.
// Credenciais vêm de env vars (secrets do GitHub Actions em CI, exportadas
// manualmente em dev local), nunca hardcoded aqui.
export const QA_EMAIL = process.env.E2E_QA_EMAIL ?? "";
export const QA_PASSWORD = process.env.E2E_QA_PASSWORD ?? "";

export async function loginAsQa(page: Page) {
  await page.goto("/pt-BR/login");
  await page.locator("#email").fill(QA_EMAIL);
  await page.locator("#password").fill(QA_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

// Clique via DOM direto (sem depender da coordenada sintética do CDP) — ver
// ai-context/skills/04-ui-design-system.md: no projeto mobile-chromium, um
// .click() normal pode travar indefinidamente num botão genuinamente
// clicável, perto do fim de uma página alta (artefato de hit-test sob
// emulação de viewport, não um bug de produto).
export async function forceClick(locator: ReturnType<Page["getByRole"]>) {
  await locator.evaluate((el) => (el as HTMLElement).click());
}

// Filtra a lista (Contatos ou Organizações, mesmo placeholder nas duas) pelo
// nome antes de qualquer lookup de linha/célula/link por nome — a lista
// pagina no SERVIDOR (ver docs/superpowers/specs/2026-10-03-server-side-list-
// pagination-design.md), então sem o filtro um lookup na lista SEM filtro
// pode simplesmente não encontrar a linha se ela caiu numa página 2+
// (silenciosamente, sem falhar o teste de um jeito óbvio). Ver
// ai-context/skills/08-testing-quality.md.
//
// A busca tem debounce de 350ms antes de navegar (`?search=...`) — só depois
// dessa navegação o servidor refaz a query filtrada. `fill()` sozinho
// retorna antes do debounce disparar, então espera a URL carregar o
// parâmetro `search` com o valor exato (codificado como
// `URLSearchParams` codifica — espaço vira `+`, não `%20`) antes de devolver
// o controle pra quem chama; sem isso, um `.count()`/asserção de ausência
// logo em seguida podia ler a página ainda não filtrada e concluir "não
// existe" por engano (achado do code review final da branch).
export async function filterList(page: Page, name: string) {
  await page.getByPlaceholder("Buscar por nome…").fill(name);
  const encodedParam = new URLSearchParams({ search: name }).toString();
  const escaped = encodedParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`[?&]${escaped}(&|$)`));
}

// Cadastro rápido de Contato (ContactCreateForm, Task 1 — Cargo virou campo
// próprio do Contato): 5 campos, todos sem `required` HTML nativo (ver
// contact-create-form.tsx — um `required` nativo bloquearia o submit antes
// da Server Action rodar, escondendo a FieldError traduzida atrás de um
// tooltip do browser). Preenche só os campos informados — quem chama decide
// o que preencher (o teste de validação de campo obrigatório vazio, por
// exemplo, propositalmente deixa um de fora) — e retorna o locator do dialog
// sem clicar em "Criar", pra quem chama poder tanto confirmar sucesso quanto
// testar um erro de validação. Promovido de `contacts.spec.ts` pra cá
// (estava duplicado ali e precisava virar helper comum): `organization-
// contact-links.spec.ts` e `organization-links.spec.ts` também criam um
// "contato de apoio" via este mesmo form, e Empresa é um campo obrigatório
// agora — não dá mais pra criar um contato preenchendo só `#full_name`.
export async function fillQuickCreateForm(
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

// Variante "feliz": preenche os 5 campos e já clica "Criar", esperando a
// navegação pro detalhe do contato novo (mesmo padrão de sucesso de
// Organizações/Contatos: criar sempre navega pro detalhe). `orgName`
// precisa ser de uma organização que já existe (o <Select> de Empresa não
// cria organização nova inline — spec "Fora de escopo").
export async function createContactViaQuickForm(
  page: Page,
  fields: { name: string; title: string; email: string; phone: string; orgName: string },
) {
  await page.goto("/pt-BR/contacts");
  const dialog = await fillQuickCreateForm(page, fields);
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
  return page.url();
}

// Limpeza best-effort para dados criados por um teste, independente dele ter
// passado ou falhado no meio do ciclo criar→editar→excluir (o nome pode estar
// no estado original OU renomeado quando a limpeza roda). Nunca falha o teste
// por conta própria — se a linha não existir, não faz nada — e por isso todo
// clique aqui é best-effort de verdade (try/catch): uma falha em LIMPAR não
// pode derrubar um teste cujas asserções já passaram.
export async function deleteRowIfExists(page: Page, listPath: string, name: string) {
  try {
    await page.goto(listPath);
    await filterList(page, name);
    const row = page.getByRole("row", { name });
    // `expect(...).not.toHaveCount(0)` é retryable (Playwright reavalia até
    // o timeout) — ao contrário de um `row.count()` síncrono, que podia ler
    // a lista um instante antes do servidor terminar de aplicar o filtro
    // (URL já confirmada por `filterList`, mas o refetch/render ainda em
    // voo) e concluir "0 linhas" por engano, fazendo a limpeza silenciosamente
    // não apagar nada (achado do code review final da branch). Timeout
    // explícito mais curto que o default (5s) — `filterList` já esperou a
    // URL carregar o parâmetro, então o que falta aqui é só o
    // refetch/render do servidor terminar (normalmente sub-segundo); um
    // teste com vários `deleteRowIfExists` no `finally`, a maioria limpando
    // linhas que já não existem (caminho feliz), não deveria pagar o
    // timeout cheio em cada uma. Se a linha genuinamente não existir, a
    // asserção esgota esse timeout e cai aqui — sem propagar pro catch
    // externo (que logaria um warning de falha de limpeza indevido para o
    // caso normal de "nada a limpar").
    try {
      await expect(row).not.toHaveCount(0, { timeout: 3_000 });
    } catch {
      return;
    }

    // Nem Contatos nem Organizações têm mais "Excluir" inline na linha desde a
    // reestruturação Lista→Detalhe→Editar (fica só no detalhe, ver
    // contact-edit-delete.tsx / organization-edit-delete.tsx) — o fallback
    // inline abaixo é só defensivo, caso algum padrão antigo reapareça.
    const inlineDelete = row.getByRole("button", { name: "Excluir" });
    if ((await inlineDelete.count()) > 0) {
      page.once("dialog", (dialog) => dialog.accept());
      await forceClick(inlineDelete);
      return;
    }

    await row.getByRole("link", { name }).click();
    page.once("dialog", (dialog) => dialog.accept());
    // `exact: true` necessário: sem ele, o botão de excluir do Contato/
    // Organização ("Excluir") casa por substring com qualquer botão de
    // excluir tarefa ("Excluir tarefa {description}") que o detalhe também
    // renderize (TasksList embutida) — uma tarefa pendente na hora da
    // limpeza vira "strict mode violation" (2+ elementos), achado ao
    // escrever o quadro Kanban de Tarefas, que deixa tarefas de teste
    // linkadas a um Contato/Organização até o fim do cenário. Mesma
    // desambiguação já usada localmente em tasks.spec.ts/organization-
    // contact-links.spec.ts; promovida pra cá por ser o fallback
    // compartilhado.
    await forceClick(page.getByRole("button", { name: "Excluir", exact: true }));
  } catch (error) {
    // Best-effort de verdade — ver comentário acima. Dado órfão de um teste
    // falho fica para limpeza manual, não derruba a suíte — mas o warn
    // mantém a falha visível no log do CI, em vez de some silenciosamente
    // (uma regressão real no botão de excluir não pode passar despercebida).
    console.warn(`deleteRowIfExists: limpeza de "${name}" falhou`, error);
  }
}
