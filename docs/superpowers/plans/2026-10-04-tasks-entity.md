# Entidade Tarefa (sub-projeto 1 de 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entidade Tarefa com CRUD básico (criar, concluir/reabrir,
excluir) vinculada a Contato ou Organização, com lista na barra lateral do
detalhe de cada um.

**Architecture:** Tabela `tasks` nova, polimórfica (`participant_type`/
`participant_id`, um participante só por tarefa — mais simples que
`interactions`/`interaction_participants`, que suporta vários). Server
Actions seguindo o padrão já estabelecido de `interactions.ts`. Componente
compartilhado `TasksList` (mesmo princípio de generalização de
`InteractionsTimeline`), usado nas duas páginas de detalhe sem duplicar
código.

**Tech Stack:** Next.js 16 (Server Components + Server Actions), Supabase
(Postgres + RLS + PostgREST), Zod, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-tasks-entity-design.md`

## Global Constraints

- Toda tarefa é sempre vinculada a um Contato OU uma Organização —
  `participant_type`/`participant_id` nunca nulos, sem tarefa solta.
- Uma tarefa tem um participante só (diferente de `interactions`, que
  suporta vários via tabela de participantes separada) — `tasks` guarda
  `participant_type`/`participant_id` direto na própria linha.
- `assigned_to` é obrigatório (`not null`), referencia `user_profiles`.
- Sem classificação de tipo/categoria — só descrição livre + data +
  status (`done_at`).
- Sem `classification_level` — policy de SELECT é `using (true)` pra
  qualquer autenticado (diferente de `interactions`).
- RLS: SELECT qualquer autenticado; INSERT/UPDATE admin+gestor+analista
  (`has_role(array['admin','gestor','analista'])`); DELETE admin+gestor
  (`has_role(array['admin','gestor'])`) — mesmo padrão já usado em
  `organizations`.
- Próxima migration disponível: `0008` (confirmado: só 0001-0007 existem).
- Fora de escopo: editar uma tarefa já criada; tipo/categoria; tarefa sem
  vínculo; Kanban; recorrência; notificações; tela própria de listagem
  agregada de tarefas.
- i18n: toda string nova pareada em `src/messages/pt-BR.json` e
  `en-US.json`, nenhum texto hardcoded.
- Server Actions: `useActionState` + Zod + `revalidatePath`, mesmo padrão
  de `src/lib/actions/interactions.ts`.

## Review Focus

- **Excluir um Contato/Organização com tarefa pendente não pode deixar
  `tasks` órfã** — `tasks` é polimórfico (sem FK real pra
  `contacts`/`organizations`, sem `ON DELETE CASCADE`), mesma classe de
  bug real já documentada no roadmap para `entity_tags`/
  `interaction_participants` antes do helper de limpeza cobrir as duas.
  Testado no Task 2 (E2E).
- **`toggleTaskDone` precisa ler o estado atual do banco antes de
  inverter**, nunca confiar num valor vindo do cliente — evita uma
  Server Action que reabre uma tarefa já concluída por outra aba/pessoa
  de forma inconsistente (o cliente que disparou o toggle pode estar com
  uma visão desatualizada de `done_at`). Coberto no Task 1 (a função lê
  `done_at` antes de decidir o novo valor, não recebe o valor-alvo como
  parâmetro).
- **Lista de "Atribuída a" precisa vir de TODOS os `user_profiles`**, não
  só o perfil logado — e o `<Select>` precisa do `children` função em
  `SelectValue` (gotcha já documentado em
  `ai-context/skills/02-data-modeling.md`: Base UI mostra o valor bruto,
  não o rótulo, tanto pré-selecionado quanto escolhido interativamente).
  Testado no Task 2 (E2E: criar tarefa atribuída a outro colaborador que
  não o usuário logado, confirmar que o rótulo certo aparece, não o uuid).
- **Tarefa concluída continua visível na lista** (riscada/esmaecida), não
  desaparece — UX explícita do spec, divergente do que seria mais fácil
  de implementar (filtrar fora). Testado no Task 2 (E2E: concluir uma
  tarefa, confirmar que ela ainda aparece na lista, com o estilo
  diferenciado).
- **`participant_type` fora de `'contact'`/`'organization'` precisa
  falhar no `check` constraint do banco**, não silenciosamente aceitar
  qualquer string. Testado no Task 1 (pgTAP).

---

## Arquivos

- Criar: `supabase/migrations/0008_crm_tasks.sql`
- Criar: `supabase/tests/tasks_rls.test.sql`
- Criar: `src/lib/actions/tasks.ts`
- Modificar: `src/lib/supabase/polymorphic-cleanup.ts`
- Criar: `src/components/shared/tasks-list.tsx`
- Modificar: `src/app/[locale]/(app)/contacts/[id]/page.tsx`
- Modificar: `src/app/[locale]/(app)/organizations/[id]/page.tsx`
- Modificar: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Criar: `e2e/tasks.spec.ts`

---

### Task 1: Migration + Server Actions + limpeza polimórfica + pgTAP

**Files:**
- Create: `supabase/migrations/0008_crm_tasks.sql`
- Create: `supabase/tests/tasks_rls.test.sql`
- Create: `src/lib/actions/tasks.ts`
- Modify: `src/lib/supabase/polymorphic-cleanup.ts`

**Interfaces:**
- Produces (usado pelo Task 2):
  - `createTask(participantType: "contact" | "organization", participantId: string, _prevState: TaskFormState, formData: FormData): Promise<TaskFormState>` em `src/lib/actions/tasks.ts`. `formData` espera `description` (string), `due_date` (string, formato `datetime-local`), `assigned_to` (uuid de `user_profiles`). `TaskFormState = { error: "required_description" | "required_due_date" | "required_assigned_to" | "generic" | null; success?: boolean }`.
  - `toggleTaskDone(taskId: string): Promise<{ error: boolean }>` — lê `done_at` atual da linha, grava `null` se já tinha valor, grava `now()` (ISO) se era `null`. Não recebe o valor-alvo como parâmetro (ver Review Focus).
  - `deleteTask(taskId: string): Promise<{ error: boolean }>`.
  - Tabela `crm_abvcap.tasks` com as colunas exatas do spec (seção Arquitetura), aplicada e com tipos regenerados em `src/types/database.ts`.
- Consumes: nada de tarefa anterior (primeira tarefa do plano).

- [ ] **Step 1: Criar a migration**

Copiar literalmente o SQL da seção "Migration (próxima: `0008`)" do spec em `supabase/migrations/0008_crm_tasks.sql` — schema, índices, trigger, RLS, tudo já está lá, exato.

- [ ] **Step 2: Aplicar a migration e regenerar tipos**

Run: `npx supabase projects list` (confirmar que `SUPABASE_ACCESS_TOKEN` aponta pro projeto da org ABVCAP, `csfrlgrtedtbjwieozrp` — nunca aplicar sem confirmar isso primeiro).
Run: `npx supabase db push --linked` (precisa de `SUPABASE_DB_PASSWORD` no ambiente).
Run: `npx supabase gen types typescript --linked --schema crm_abvcap > src/types/database.ts` (mesmo comando exato já usado em todas as migrations anteriores deste projeto — não existe script npm dedicado, confirmado em `package.json`).
Expected: `tasks` aparece em `src/types/database.ts` com as colunas do Step 1.

- [ ] **Step 3: Escrever o teste pgTAP de RLS**

Em `supabase/tests/tasks_rls.test.sql`, mesmo padrão exato de
`supabase/tests/organizations_rls.test.sql` (fixtures de `auth.users` +
`user_profiles` sem senha, `set local role`/`set local
request.jwt.claim.sub`, `begin`/`select plan(N)`/`rollback` no final).
Precisa de uma fixture adicional: uma linha em `contacts` (qualquer
`full_name` válido) pra servir de `participant_id` das tarefas de teste —
`organization_id` default já cobre o tenant. Casos a cobrir (plan(7) ou o
número exato que resultar):
1. Analista cria uma tarefa (`insert ... returning description`).
2. Leitura NÃO cria tarefa (`throws_ok`, código `42501`).
3. Leitura PODE ler a tarefa criada (INTERNAL = qualquer autenticado).
4. Analista PODE concluir (update `done_at`) — `results_eq` ou `ok`.
5. Analista NÃO exclui (`is_empty` no delete, mesmo padrão do teste de
   organizations).
6. Admin EXCLUI (`results_eq`).
7. `insert` com `participant_type = 'invalido'` falha no `check`
   constraint (`throws_ok`, código `23514` — violação de check
   constraint, não `42501`).

**Este teste não roda sozinho neste ambiente** (sem Docker local) — fica
pronto pro usuário rodar manualmente via SQL Editor do dashboard Supabase
quando ele decidir (mesmo processo já estabelecido no projeto,
`ai-context/skills/08-testing-quality.md`). Não bloqueia os passos
seguintes.

- [ ] **Step 4: Implementar os Server Actions em `src/lib/actions/tasks.ts`**

Assinaturas exatas no bloco Interfaces acima. Seguir a estrutura de
`src/lib/actions/interactions.ts`: schema Zod (`description: z.string().trim().min(1)`,
`due_date: z.string().min(1)`, `assigned_to: z.string().min(1)`),
`revalidateParticipant(participantType)` (mesma função, mesmo padrão —
pode duplicar a pequena função ou extrair pra um util compartilhado, à
escolha do implementador, mas mantendo o mesmo efeito: invalida a lista E
o detalhe do recurso certo). `toggleTaskDone`: `select done_at from
tasks where id = taskId` primeiro, depois `update` com o valor invertido
(ver Review Focus — nunca receber o valor-alvo do chamador).

- [ ] **Step 5: Atualizar `cleanupPolymorphicReferences` em `src/lib/supabase/polymorphic-cleanup.ts`**

Adiciona um `delete from tasks where participant_type = entityType and
participant_id = entityId` — mais simples que a limpeza de
`interaction_participants` (sem RPC/`SECURITY DEFINER` necessário, já que
a policy de SELECT de `tasks` é `using (true)`, sem filtro de
classificação que poderia esconder uma linha do DELETE em lote — ver
Global Constraints). Chamar antes do `await supabase.from(entityType ===
"contact" ? "contacts" : "organizations").delete()...` já existente —
mesma posição que as chamadas de `entity_tags`/`interaction_participants`
já ocupam na função.

- [ ] **Step 6: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_crm_tasks.sql supabase/tests/tasks_rls.test.sql src/lib/actions/tasks.ts src/lib/supabase/polymorphic-cleanup.ts src/types/database.ts
git commit -m "feat: entidade Tarefa — migration, Server Actions, limpeza polimórfica"
```

---

### Task 2: `TasksList` + integração nas páginas de detalhe + i18n + E2E

**Files:**
- Create: `src/components/shared/tasks-list.tsx`
- Modify: `src/app/[locale]/(app)/contacts/[id]/page.tsx`
- Modify: `src/app/[locale]/(app)/organizations/[id]/page.tsx`
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Create: `e2e/tasks.spec.ts`

**Interfaces:**
- Consumes: `createTask`/`toggleTaskDone`/`deleteTask` de
  `src/lib/actions/tasks.ts`, exatamente como definidos na Task 1 —
  nenhuma mudança nesse arquivo nesta tarefa.
- Produces: `TasksList({ participantType, participantId, tasks, assignableProfiles, currentProfileId }: { participantType: "contact" | "organization"; participantId: string; tasks: TaskRow[]; assignableProfiles: { id: string; name: string }[]; currentProfileId: string })` em `src/components/shared/tasks-list.tsx`, onde `TaskRow = { id: string; description: string; due_date: string; assigned_to: string; assigned_to_name: string; done_at: string | null }` (exportado do mesmo arquivo, mesmo padrão de `InteractionRow` em `interactions-timeline.tsx`). `currentProfileId` é só repassado pro `defaultValue` do `<Select>` de "Atribuída a" dentro de `AddTaskForm` (ver Step 3) — a página descobre quem está logado, o componente só usa o valor pronto.

- [ ] **Step 1: Escrever o teste E2E do ciclo completo a partir de Contato**

Novo arquivo `e2e/tasks.spec.ts`, mesmo padrão de setup/cleanup de
`contacts.spec.ts` (`loginAsQa` no `beforeEach`, nomes únicos com
timestamp, `try`/`finally` com `deleteRowIfExists`). Teste
`"ciclo completo de Tarefa a partir do detalhe do Contato: criar,
concluir, reabrir, excluir"`: cria uma organização + um contato via
`createContactViaQuickForm` (já existe em `e2e/helpers.ts`), abre o
detalhe do contato, cria uma tarefa (descrição única com timestamp, data
qualquer futura, atribuída a si mesmo — `qa@abvcap.com.br`/"QA" deve
aparecer como opção do `<Select>`), confirma que aparece na lista como
pendente; clica no checkbox, confirma que passa a aparecer com o estilo
de concluída (ex.: `line-through` na classe, ou checar o atributo
`aria-checked`/`checked` do checkbox, à escolha do implementador
conforme o componente real da Task 2); clica de novo, confirma que volta
a pendente; clica na lixeira (`window.confirm` mockado, mesmo padrão de
`ContactTags`), confirma que some da lista.

- [ ] **Step 2: Rodar e confirmar que falha pelo motivo certo**

Run: `npx playwright test e2e/tasks.spec.ts -g "a partir do detalhe do Contato" --project=chromium --reporter=line`
Expected: FAIL — `TasksList` ainda não existe, nem a integração na página.

- [ ] **Step 3: Implementar `TasksList` em `src/components/shared/tasks-list.tsx`**

Assinatura exata no bloco Interfaces. Mesma estrutura de
`InteractionsTimeline`: um subcomponente de form inline (`AddTaskForm`,
mesmo padrão de `AddInteractionForm` — `useActionState` com
`createTask.bind(null, participantType, participantId)`, nonce `formKey`
pra resetar o form depois de criar com sucesso) + a lista em si.

Lista: `tasks` ordenada no próprio componente (não precisa vir ordenada
do servidor) — pendentes primeiro por `due_date` ascendente, concluídas
depois por `done_at` descendente (mais recente primeiro). Cada linha:
checkbox controlado (chama `toggleTaskDone(task.id)` direto no
`onChange`, sem `useActionState` — é uma ação simples sem campos de
form), descrição, data formatada (`toLocaleString()`, mesmo padrão de
`InteractionsTimeline`), nome de quem está atribuída, botão de lixeira
(`window.confirm` antes de chamar `deleteTask`, mesmo padrão de
`ContactTags`/`handleRemove`). Linha de tarefa concluída usa
`line-through`/`text-muted-foreground` (ou equivalente) pra diferenciar
visualmente sem sumir da lista (ver Review Focus).

Campo "Atribuída a" do form: `<Select name="assigned_to" required>` com
`assignableProfiles` como opções, `defaultValue` no id do perfil logado
(a página de detalhe passa isso pronto, não é responsabilidade deste
componente descobrir quem está logado). `SelectValue` com `children`
função mostrando o nome do perfil (não o uuid) — mesmo gotcha documentado
em `ai-context/skills/02-data-modeling.md`, já replicado em
`InteractionsTimeline`/`contact-links.tsx`/`organization-links.tsx`.

- [ ] **Step 4: Integrar em `contacts/[id]/page.tsx`**

Adiciona ao `Promise.all` existente uma query `supabase.from("tasks")
.select("id, description, due_date, assigned_to, done_at,
user_profiles(name)") .eq("participant_type", "contact")
.eq("participant_id", id)` e outra `supabase.from("user_profiles")
.select("id, name").order("name", { ascending: true })` (lista completa
de atribuíveis — sem filtro de papel, qualquer perfil pode ser
atribuído). Monta `TaskRow[]` (achatando `user_profiles(name)` em
`assigned_to_name`, mesmo padrão de achatamento já usado pra
`organizations(name)` nos links). Usa `getCurrentProfile()` (já existe, `src/lib/supabase/current-profile.ts`
— `contacts/[id]/page.tsx` hoje NÃO importa esse helper, precisa adicionar
o import) pra pegar o perfil logado. `getCurrentProfile()` retorna
`| null` no tipo, mas `(app)/layout.tsx` já redireciona pra `/login`
antes de qualquer página aninhada renderizar se não houver perfil — essa
página já está sempre dentro desse guard, então um `if (!profile)
notFound()` (ou equivalente, só pra satisfazer o TypeScript, nunca deve
disparar de verdade em uso normal) antes de montar `currentProfileId` é
suficiente. Renderiza `<TasksList
participantType="contact" participantId={id} tasks={...}
assignableProfiles={...} currentProfileId={profile.id} />` no final da
coluna lateral (`lg:w-80`), depois de `OrganizationLinks`.

- [ ] **Step 5: Integrar em `organizations/[id]/page.tsx`**

Mesmo padrão do Step 4, trocando `"contact"` por `"organization"` e
`participant_id` pelo `id` da organização. Mesma posição na coluna
lateral (depois de `ContactLinks`).

- [ ] **Step 6: i18n**

Novo namespace `TasksList` em `src/messages/pt-BR.json` e `en-US.json`,
pareado. Chaves necessárias (nomes exatos, à escolha do implementador
escolher o texto, mas os NOMES de chave abaixo são o contrato que o
componente da Step 3 usa — manter consistentes entre os dois arquivos):
`title`, `empty`, `fieldDescription`, `fieldDueDate`, `fieldAssignedTo`,
`selectPlaceholder`, `add`, `submitting`, `errorRequiredDescription`,
`errorRequiredDueDate`, `errorRequiredAssignedTo`, `errorGeneric`,
`deleteConfirm`, `deleteLabel` (com placeholder `{description}`, mesmo
padrão de `tagsRemoveLabel` em `ContactTags`).

- [ ] **Step 7: Rodar o teste da Step 1 e confirmar que passa**

Run: `npx playwright test e2e/tasks.spec.ts -g "a partir do detalhe do Contato" --project=chromium --reporter=line`
Expected: PASS

- [ ] **Step 8: Escrever e rodar o mesmo ciclo a partir de Organização**

Novo teste no mesmo arquivo, `"ciclo completo de Tarefa a partir do
detalhe da Organização: criar, concluir, reabrir, excluir"` — mesmo
roteiro do Step 1, usando `createOrg` (já existe nos helpers de
`e2e/organizations.spec.ts` ou `e2e/helpers.ts`, conferir qual) e
navegando pro detalhe da organização em vez do contato.

Run: `npx playwright test e2e/tasks.spec.ts -g "a partir do detalhe da Organização" --project=chromium --reporter=line`
Expected: PASS

- [ ] **Step 9: Escrever e rodar o teste de limpeza polimórfica (Review Focus)**

Novo teste: `"excluir um Contato com tarefa pendente não deixa linha
órfã"` — cria um contato, cria uma tarefa pendente pra ele, exclui o
contato a partir do detalhe (fluxo já existente de
`ContactEditDelete`/`handleDelete`), confirma que a navegação volta pra
`/contacts` com sucesso (o teste não tem acesso direto ao banco pra
verificar a ausência da linha órfã por SQL — a prova indireta é que o
delete do contato não falha/trava; se quiser uma prova mais forte, o
implementador pode decidir recriar o mesmo contato e confirmar que
nenhuma tarefa antiga "vaza" pra ele, mas isso é opcional, à escolha de
quem implementa, dado que o teste de RLS do Task 1 já cobre o
comportamento da tabela em si).

Run: `npx playwright test e2e/tasks.spec.ts --project=chromium --reporter=line`
Expected: todos os testes do arquivo passam.

- [ ] **Step 10: Suíte E2E completa**

Run: `E2E_QA_EMAIL='qa@abvcap.com.br' E2E_QA_PASSWORD='@Bvcap2026' npx playwright test --reporter=line`
Expected: suíte inteira passa — nenhuma regressão em `contacts.spec.ts`/
`organizations.spec.ts` (que agora renderizam uma seção nova nas duas
páginas de detalhe) nem nos specs de vínculo.

- [ ] **Step 11: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos.

- [ ] **Step 12: Commit**

```bash
git add src/components/shared/tasks-list.tsx src/app/"[locale]"/"(app)"/contacts/"[id]"/page.tsx src/app/"[locale]"/"(app)"/organizations/"[id]"/page.tsx src/messages/pt-BR.json src/messages/en-US.json e2e/tasks.spec.ts
git commit -m "feat: lista de Tarefas no detalhe de Contato e Organização"
```
