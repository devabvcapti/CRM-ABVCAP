# Quadro Kanban de Tarefas (sub-projeto 2 de 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quadro Kanban de Tarefas (3 colunas: A Fazer / Em Andamento /
Concluída) numa página nova `/tasks`, com arrastar-e-soltar persistindo
no servidor com mutação otimista.

**Architecture:** Nova coluna `status` em `tasks` (`done_at` passa a ser
derivado dela). Nova Server Action `setTaskStatus` substitui
`setTaskDone`. Página `/tasks` (Server Component) agrega todas as
tarefas do CRM, agrupadas por status; um Client Component usa o
primitivo já vendorizado `reui/kanban.tsx` (nunca usado em produto real
até agora) pro drag-and-drop.

**Tech Stack:** Next.js 16 (Server Components + Server Actions),
Supabase (Postgres + RLS), `@dnd-kit` (via `reui/kanban.tsx`, já
vendorizado), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-tasks-kanban-design.md`

## Global Constraints

- `tasks.status` é `text not null default 'a_fazer' check (status in
  ('a_fazer', 'em_andamento', 'concluida'))`. Nenhuma mudança de RLS —
  a policy de UPDATE existente (`tasks_update_write_roles`) já cobre
  qualquer coluna.
- `done_at` é **derivado** de `status`, nunca escrito independentemente:
  toda escrita que leva `status` pra `'concluida'` seta `done_at =
  now()`; qualquer outra escrita de `status` limpa `done_at = null`.
- `setTaskDone(taskId, done)` é **removida** — `TasksList` (sub-projeto
  1, já em produção) passa a chamar `setTaskStatus(taskId, done ?
  "concluida" : "a_fazer")` direto no checkbox.
- Colunas do Kanban **não são arrastáveis** entre si (sem
  `KanbanColumnHandle` renderizado) — só os cards de tarefa se movem.
- Criar uma tarefa a partir do Kanban fica fora de escopo — criar
  continua só a partir do detalhe de Contato/Organização.
- Editar uma tarefa a partir do card fica fora de escopo (mesma regra
  desde o sub-projeto 1) — só mudar status (arrastar) e excluir.
- Filtro por responsável ou qualquer outro filtro na página `/tasks`
  fica fora de escopo, **exceto** o toggle "Minhas tarefas" (Task 2) —
  o resto mostra todas as tarefas, sempre.
- Toggle "Minhas tarefas" (adição pós-spec, pedida depois do plano
  inicial estar rascunhado) é puramente visual: filtra o que é
  renderizado, nunca o `value` controlado passado ao primitivo `Kanban`
  nem a lógica de `onValueChange`/`onValueCommit` — arrastar continua
  operando sobre o conjunto completo de tarefas com o toggle ligado ou
  desligado. Desligado por padrão.
- Indicador de atraso/vencimento (mesma adição pós-spec) é calculado
  uma vez no Server Component no momento do fetch — sem polling/timer
  client-side, mesma defasagem natural de qualquer outro dado já
  renderizado no projeto.
- Próxima migration: `0009`.
- i18n: toda string nova pareada em `src/messages/pt-BR.json`/
  `en-US.json`, nenhum texto hardcoded.

## Review Focus

- **Coluna vazia não pode quebrar o quadro**: `KanbanColumnContent`
  (`reui/kanban.tsx`) lança uma exceção se a chave da coluna não existir
  no objeto `value` passado ao `Kanban` — o agrupamento no servidor
  precisa **sempre** inicializar as 3 chaves (`a_fazer`/`em_andamento`/
  `concluida`), mesmo com array vazio, nunca só as que têm tarefas.
  Testado na Task 2 (cenário com uma coluna vazia).
- **`revalidateParticipant` nunca invalidava `/tasks`** (achado durante a
  escrita deste plano, não estava na spec): a função compartilhada por
  `createTask`/`setTaskDone`(agora `setTaskStatus`)/`deleteTask` só
  invalidava as páginas de Contato/Organização. Sem corrigir isso,
  qualquer mutação de tarefa deixaria o Kanban com dado desatualizado
  até um reload manual — o próprio bug de cache que este sub-projeto
  existiria para expor. Corrigido na Task 1 (um ponto só, afeta as três
  Server Actions de uma vez).
- **Drag que falha no servidor precisa desfazer a UI visualmente**, não
  só logar — `onValueCommit` roda depois que `onValueChange` já moveu o
  card otimisticamente; se `setTaskStatus` retornar erro, a tela
  continua mostrando o card na coluna errada pra sempre, sem nenhum
  aviso, se o rollback não for implementado. Testado na Task 2.
- **Nome do participante resolvido pros dois tipos numa lista mista**:
  primeira vez no projeto que uma tela precisa resolver nomes de
  Contato E Organização na MESMA consulta (até agora sempre era um tipo
  por vez, escopado a uma página de detalhe já de um tipo só). Risco
  real de esquecer de popular um dos dois mapas de nome, ou cruzar
  `participant_id` com o mapa errado. Testado na Task 2 (tarefa de
  Contato e tarefa de Organização aparecem lado a lado no quadro, cada
  uma com o nome certo).
- **Checkbox da lista existente (sub-projeto 1) precisa continuar
  funcionando** depois da troca de `setTaskDone` pra `setTaskStatus` —
  os testes E2E já existentes de `tasks.spec.ts` (ciclo completo a
  partir de Contato/Organização) já exercitam esse caminho; a Task 1
  precisa confirmar que continuam passando, não escrever um teste novo
  pra isso.
- **Toggle "Minhas tarefas" não pode mudar o resultado de um drag**:
  como o filtro é só visual (ver Global Constraints), o `value` do
  `Kanban` precisa continuar sendo `columns` inteiro, nunca uma versão
  filtrada — passar a versão filtrada pro `value` faria o componente
  "esquecer" os cards escondidos e perdê-los do estado ao mover
  qualquer outro card. Testado na Task 2 (arrastar um card com o toggle
  ligado não faz nenhum card desaparecer do quadro).
- **Selo de atraso não pode aparecer numa tarefa concluída**: calcular
  `isOverdue`/`isDueSoon` sem checar `status === 'concluida'` primeiro
  marcaria como "atrasada" uma tarefa cujo prazo passou mas que já foi
  resolvida — sinal falso que mina a confiança no indicador. Testado na
  Task 2.

---

## Arquivos

- Criar: `supabase/migrations/0009_crm_tasks_status.sql`
- Modificar: `supabase/tests/tasks_rls.test.sql`
- Modificar: `src/lib/actions/tasks.ts`
- Modificar: `src/components/shared/tasks-list.tsx`
- Criar: `src/app/[locale]/(app)/tasks/page.tsx`
- Criar: `src/app/[locale]/(app)/tasks/tasks-kanban.tsx`
- Modificar: `src/components/app-sidebar.tsx`
- Modificar: `src/app/[locale]/(app)/layout.tsx`
- Modificar: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Criar: `e2e/tasks-kanban.spec.ts`

---

### Task 1: Migration + `setTaskStatus` + migração do checkbox existente

**Files:**
- Create: `supabase/migrations/0009_crm_tasks_status.sql`
- Modify: `supabase/tests/tasks_rls.test.sql`
- Modify: `src/lib/actions/tasks.ts`
- Modify: `src/components/shared/tasks-list.tsx`

**Interfaces:**
- Produces (usado pela Task 2):
  - `export type TaskStatus = "a_fazer" | "em_andamento" | "concluida";`
    em `src/lib/actions/tasks.ts`.
  - `setTaskStatus(taskId: string, status: TaskStatus): Promise<{ error: boolean }>` — substitui `setTaskDone`. Mesmo padrão de round-trip único já usado em `deleteTask` (`.update({...}).eq("id", taskId).select("participant_type").single()`).
  - `revalidateParticipant` (já existe, modificada) — passa a invalidar `/[locale]/tasks` sempre, além das rotas de Contato/Organização já existentes.
- Consumes: nada de tarefa anterior (primeira tarefa do plano).

- [ ] **Step 1: Criar a migration**

Em `supabase/migrations/0009_crm_tasks_status.sql`:

```sql
alter table crm_abvcap.tasks
  add column status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'concluida'));
```

- [ ] **Step 2: Aplicar a migration e regenerar tipos**

Run: `npx supabase projects list` (confirmar que `SUPABASE_ACCESS_TOKEN` aponta pro projeto da org ABVCAP, `csfrlgrtedtbjwieozrp` — nunca aplicar sem confirmar isso primeiro).
Run: `npx supabase db push --linked` (precisa de `SUPABASE_DB_PASSWORD` no ambiente).
Run: `npx supabase gen types typescript --linked --schema crm_abvcap > src/types/database.ts`
Expected: `tasks.Row`/`Insert`/`Update` em `src/types/database.ts` ganham o campo `status: string`.

- [ ] **Step 3: Estender o pgTAP de RLS**

Em `supabase/tests/tasks_rls.test.sql`, mesmo arquivo do sub-projeto 1 —
atualizar `select plan(N)` pro novo total e adicionar um caso: insert
com `status = 'invalido'` falha no `check` constraint (`throws_ok`,
código `23514` — mesmo padrão já usado pro caso de `participant_type`
inválido no mesmo arquivo).

Não roda sozinho neste ambiente (sem Docker local) — fica pronto pro
usuário rodar manualmente via SQL Editor do dashboard Supabase, mesmo
processo já estabelecido no sub-projeto 1.

- [ ] **Step 4: Implementar `setTaskStatus` e corrigir `revalidateParticipant` em `src/lib/actions/tasks.ts`**

Adiciona `export type TaskStatus = "a_fazer" | "em_andamento" |
"concluida";`. Implementa `setTaskStatus(taskId, status)`: mesma
estrutura de `setTaskDone` (que está sendo removida), mas grava
`{ status, done_at: status === "concluida" ? new Date().toISOString() :
null }` no `.update(...)` em vez de só `done_at`. Remove `setTaskDone`
inteiramente (nenhum outro arquivo deste projeto a chama além de
`tasks-list.tsx`, que a Step 5 atualiza).

Modifica `revalidateParticipant(participantType)`: além das duas
`revalidatePath` já existentes (recurso + `/[id]`), adiciona uma
terceira chamada incondicional `revalidatePath("/[locale]/tasks",
"page")` — roda sempre, independente do `participantType`, já que a
página `/tasks` (Task 2) agrega tarefas dos dois tipos.

- [ ] **Step 5: Atualizar o checkbox em `src/components/shared/tasks-list.tsx`**

Troca o import de `setTaskDone` por `setTaskStatus` (de
`@/lib/actions/tasks`). `handleToggle(taskId: string, done: boolean)`
passa a chamar `setTaskStatus(taskId, done ? "concluida" : "a_fazer")`
em vez de `setTaskDone(taskId, done)` — mesma assinatura de
`handleToggle`, mesmo call site no `onCheckedChange` do checkbox, só
troca qual Server Action é chamada por dentro.

- [ ] **Step 6: Rodar a suíte E2E existente de `tasks.spec.ts` e confirmar que continua passando**

O teste de limpeza órfã (sub-projeto 1) já consulta o banco direto via
`@supabase/supabase-js`, então precisa das mesmas 4 variáveis de
ambiente de sempre, não só as 2 de QA — sem `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY` esse teste específico falha por
`supabaseUrl is required`, não por um bug real (achado real do
controller numa tarefa anterior desta mesma branch de Tarefas — não
repetir).

Run: `E2E_QA_EMAIL='qa@abvcap.com.br' E2E_QA_PASSWORD="$E2E_QA_PASSWORD" NEXT_PUBLIC_SUPABASE_URL=<valor de .env.local> NEXT_PUBLIC_SUPABASE_ANON_KEY=<valor de .env.local> npx playwright test e2e/tasks.spec.ts --reporter=line`
Expected: todos os testes já existentes (ciclo completo a partir de
Contato/Organização, limpeza órfã) continuam passando — isso é o teste
de regressão do checkbox migrado pra `setTaskStatus` (ver Review
Focus), nenhum teste novo precisa ser escrito pra isso.

- [ ] **Step 7: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0009_crm_tasks_status.sql supabase/tests/tasks_rls.test.sql src/lib/actions/tasks.ts src/components/shared/tasks-list.tsx src/types/database.ts
git commit -m "feat: coluna status em tasks, setTaskStatus substitui setTaskDone"
```

---

### Task 2: Página `/tasks` + quadro Kanban + navegação + E2E

**Files:**
- Create: `src/app/[locale]/(app)/tasks/page.tsx`
- Create: `src/app/[locale]/(app)/tasks/tasks-kanban.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Create: `e2e/tasks-kanban.spec.ts`

**Interfaces:**
- Consumes: `setTaskStatus`/`deleteTask`/`TaskStatus` de
  `src/lib/actions/tasks.ts`, exatamente como definidos na Task 1 —
  nenhuma mudança nesse arquivo nesta tarefa. `Kanban`/`KanbanBoard`/
  `KanbanColumn`/`KanbanColumnHandle` (não renderizado)/
  `KanbanColumnContent`/`KanbanItem`/`KanbanItemHandle`/`KanbanOverlay`
  de `src/components/reui/kanban.tsx` (não modificar esse arquivo —
  componente vendorizado, só consumir).
- Produces: nada (última tarefa do plano).

- [ ] **Step 1: Escrever o teste E2E do ciclo completo do Kanban**

Novo arquivo `e2e/tasks-kanban.spec.ts`, mesmo padrão de setup/cleanup
de `tasks.spec.ts` (`loginAsQa` no `beforeEach`, nomes únicos com
timestamp, `try`/`finally` com `deleteRowIfExists`, e o client Node
`@supabase/supabase-js` separado — mesma técnica já estabelecida no
sub-projeto 1 pra verificação direta contra o banco, incluindo o assert
duro no resultado de `signInWithPassword` antes de qualquer query).

Teste `"tarefa criada no detalhe do Contato aparece em 'A Fazer' no
quadro; arrastar pra 'Concluída' persiste; excluir pelo card some do
quadro"`: cria uma organização + um contato via helpers existentes,
cria uma tarefa (descrição única com timestamp) pelo detalhe do
contato, navega pra `/tasks`, confirma que o card aparece na coluna "A
Fazer" (`getByRole("heading"` ou texto da coluna + o card dentro dela,
a estrutura exata de DOM é decisão da Task 2 Step 3/4, mas a localização
deve ser inequívoca — ex.: escopar a busca do card a um `locator` da
coluna "A Fazer" antes de procurar o texto da descrição dentro dele, não
só `page.getByText(description)` solto, que bateria em qualquer
coluna). Arrasta o card pra "Concluída" via `locator.dragTo()` (API
nativa do Playwright, não `waitForTimeout`/mouse manual). Depois do
drag, consulta `tasks` direto via o client Node (mesma técnica do
sub-projeto 1) filtrando por `description` e confirma `status ===
"concluida"` — prova real contra o banco, não só a posição visual do
card. Clica no botão de excluir do card (mesmo `window.confirm`
mockado já usado em outros testes), confirma que o card some da tela.

- [ ] **Step 2: Rodar e confirmar que falha pelo motivo certo**

Run: `E2E_QA_EMAIL='qa@abvcap.com.br' E2E_QA_PASSWORD="$E2E_QA_PASSWORD" NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npx playwright test e2e/tasks-kanban.spec.ts --project=chromium --reporter=line`
Expected: FAIL — a rota `/tasks` ainda não existe (404).

- [ ] **Step 3: Implementar a página `src/app/[locale]/(app)/tasks/page.tsx`**

Server Component. Busca em paralelo (`Promise.all`): todas as `tasks`
(`select("id, description, due_date, assigned_to, status,
participant_type, participant_id, user_profiles(name)")`, sem filtro —
mostra tudo, decisão do spec), todos os `contacts` (`select("id,
full_name")`), todas as `organizations` (`select("id, name")`). Monta
dois mapas de nome (`Map<string, string>`, um por tipo de participante)
e resolve o nome de cada tarefa olhando o mapa certo conforme seu
`participant_type` (ver Review Focus — nome resolvido pros dois tipos
numa lista mista).

Agrupa em `Record<TaskStatus, TaskCard[]>` **sempre inicializando as 3
chaves** mesmo vazias (ver Review Focus —
`{ a_fazer: [], em_andamento: [], concluida: [] }` como base, depois
empurra cada tarefa na chave certa) antes de passar pro Client
Component.

`TaskCard` (tipo exportado deste arquivo ou de `tasks-kanban.tsx`, à
escolha do implementador, mas usado em ambos): `{ id: string;
description: string; due_date: string; assignedToId: string;
assignedToName: string; participantType: "contact" | "organization";
participantId: string; participantName: string; isOverdue: boolean;
isDueSoon: boolean }`. `assignedToId` é o `assigned_to` bruto da
tarefa (precisa estar no `select` da Step anterior, mesmo que não fosse
usado antes desta adição) — necessário pro toggle "Minhas tarefas" da
Step 4 comparar contra o perfil logado, já que `assignedToName` não é
uma chave estável. `isOverdue`/`isDueSoon` são calculados aqui, ao
montar cada `TaskCard`, com `status !== "concluida"` como primeira
condição (ver Review Focus — selo de atraso numa tarefa concluída):
`isOverdue = status !== "concluida" && new Date(due_date) < now`;
`isDueSoon = status !== "concluida" && !isOverdue && new Date(due_date).getTime() - now.getTime() <= 24 * 60 * 60 * 1000`
(`now = new Date()`, uma vez só no topo da função, não recalculado por
tarefa).

Busca também o perfil logado (`getCurrentProfile()`, já usado no
sub-projeto 1 pra pré-selecionar o responsável no form de criar
tarefa) e passa `currentProfileId: profile.id` como prop adicional pro
Client Component — usado só pelo toggle "Minhas tarefas" da Step 4.

- [ ] **Step 4: Implementar o Client Component `src/app/[locale]/(app)/tasks/tasks-kanban.tsx`**

Recebe `columns: Record<TaskStatus, TaskCard[]>` e `currentProfileId:
string` como props iniciais. `columns` vai pro `useState` local
(precisa ser mutável pro `onValueChange` otimista do `Kanban`).
Separado, um segundo `useState<boolean>(false)` pro toggle "Minhas
tarefas" (`onlyMine`/`setOnlyMine`, desligado por padrão — Global
Constraint). **Importante**: `value` passado ao `Kanban` é sempre
`columns` inteiro, nunca uma versão filtrada por `onlyMine` (ver Global
Constraint e Review Focus — toggle não pode mudar o resultado de um
drag); o filtro entra só na hora de renderizar cada `KanbanItem` dentro
de `KanbanColumnContent` (Step abaixo), nunca no dado que o `Kanban`
controla. Usa `Kanban<TaskCard> value={columns}
onValueChange={setColumns} getItemValue={(card) => card.id}
onValueCommit={handleCommit}`, onde `handleCommit(value, meta)`: se
`meta.kind !== "item"`, retorna sem fazer nada (colunas não são
arrastáveis, mas o tipo do callback cobre os dois casos); chama
`setTaskStatus(taskId, meta.overContainer as TaskStatus)` — em
`KanbanCommitMeta` (ver `reui/kanban.tsx`), `meta.overContainer` é a
coluna de DESTINO (onde o card caiu) e `meta.activeContainer` é a
coluna de ORIGEM; é `overContainer` que vira o novo `status`. `taskId`
vem de `event.active.id` (`meta.event`, o `DragEndEvent` original) ou,
mais simples, de percorrer `value[meta.overContainer]` usando o índice
`meta.overIndex`. Se der erro, `setColumns(meta.previousValue)` (desfaz
a UI) + `window.alert(t("errorGeneric"))` (mesmo padrão já usado em
`TasksList`).

Dentro de cada `KanbanColumn`, renderiza `KanbanColumnContent` com os
cards; cada `KanbanItem` precisa ter um `KanbanItemHandle` em algum
lugar dentro dele — sem isso o item não é arrastável de verdade
(`KanbanItem` sozinho aplica só os `attributes` do `dnd-kit` ao nó raiz;
são os `listeners` — que só `KanbanItemHandle` recebe via contexto —
que de fato habilitam o gesto de arrastar; confirmado lendo
`KanbanItem`/`KanbanItemHandle` em `reui/kanban.tsx`). Mais simples:
envolver o card inteiro num único `KanbanItemHandle` (igual o card
inteiro ser "pegável", não só um ícone de grip pequeno). Cada card
mostra descrição, prazo
formatado, nome do responsável, link pro Contato/Organização
(`/contacts/{participantId}` ou `/organizations/{participantId}`
conforme `participantType`), e um botão de excluir chamando
`deleteTask(card.id)` com `window.confirm` antes (mesmo padrão de
`TasksList`) — ao excluir com sucesso, remove o card do `columns` local
também (não basta confiar só na revalidação de rota, já que o estado
do Kanban é local/controlado).

Se `onlyMine && card.assignedToId !== currentProfileId`, o
`KanbanItem` desse card renderiza `null` em vez do conteúdo normal
(esconde visualmente, não remove de `columns`/do `value` do `Kanban` —
ver nota na abertura deste Step).

Selo de atraso/vencimento (`Badge` de `@/components/ui/badge`, mesmo
componente já usado em outros lugares do projeto pra badges de
status): se `card.isOverdue`, `<Badge variant="destructive">
{t("urgencyOverdue")}</Badge>` ao lado do prazo formatado; senão, se
`card.isDueSoon`, um badge equivalente com `variant="outline"` e
`t("urgencyDueSoon")`; se nenhum dos dois, nenhum badge.

Acima do quadro (fora de qualquer `KanbanColumn`), um `Switch` (`@/
components/ui/switch`) controlado por `onlyMine`/`setOnlyMine`, com
label `t("onlyMineToggle")` ao lado.

Nenhuma coluna ganha `KanbanColumnHandle` (Global Constraint — colunas
não são arrastáveis).

- [ ] **Step 5: Adicionar o item de navegação "Tarefas"**

Em `src/components/app-sidebar.tsx`: estende o tipo `NavItem["href"]`
pra incluir `"/tasks"`, adiciona um ícone do `lucide-react` (ex.:
`ListTodoIcon` ou `CheckSquareIcon` — escolha do implementador, qualquer
ícone de lista/tarefa já disponível no pacote já instalado), adiciona o
item ao array `items` (posição: entre Dashboard e Contatos, ou onde
fizer sentido visualmente — decisão do implementador) usando
`navLabels.tasks` como label.

Em `src/app/[locale]/(app)/layout.tsx`: adiciona `tasks:
t("navTasks")` ao objeto `navLabels` passado pro `AppSidebar`, e estende
o tipo de prop `navLabels` do `AppSidebar` (em `app-sidebar.tsx`) pra
incluir `tasks: string`.

- [ ] **Step 6: i18n**

Novo namespace `TasksKanbanPage` (ou reusa/estende `TasksList` já
existente — decisão do implementador, mas sem duplicar chaves que já
existem como `errorGeneric`/`deleteConfirm`/`deleteLabel`, que podem ser
compartilhadas entre os dois componentes se estiverem no mesmo
namespace) em `src/messages/pt-BR.json`/`en-US.json`, pareado. Chaves
mínimas necessárias: `title` (título da página), `columnAFazer`,
`columnEmAndamento`, `columnConcluida` (rótulos das 3 colunas),
`fieldAssignedTo` ou reuso do já existente, `onlyMineToggle` (label do
toggle "Minhas tarefas"), `urgencyOverdue` ("Atrasada"),
`urgencyDueSoon` ("Vence em breve"), mais `navTasks` em `AppShell`
(namespace onde `navDashboard`/`navContacts`/`navOrganizations` já
vivem).

- [ ] **Step 7: Rodar o teste da Step 1 e confirmar que passa**

Run: `E2E_QA_EMAIL='qa@abvcap.com.br' E2E_QA_PASSWORD="$E2E_QA_PASSWORD" NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npx playwright test e2e/tasks-kanban.spec.ts --project=chromium --reporter=line`
Expected: PASS

- [ ] **Step 8: Escrever e rodar o teste de coluna vazia e nome misto (Review Focus)**

Novo teste: `"quadro mostra tarefas de Contato e Organização lado a
lado, com o nome certo cada uma"` — cria uma tarefa vinculada a um
Contato e outra vinculada a uma Organização (nomes distintos,
timestamped), navega pra `/tasks`, confirma que as duas aparecem na
coluna "A Fazer", cada uma com o link/nome do participante certo (não
trocado). Não precisa de uma coluna vazia FORÇADA como teste à parte —
"Em Andamento"/"Concluída" já começam vazias em qualquer execução nova
da suíte (nenhum teste anterior move tarefa pra lá antes deste rodar),
então a ausência de erro ao carregar `/tasks` já exercita o caso de
coluna vazia implicitamente; se quiser uma asserção explícita, o
implementador pode adicionar `expect(colunaEmAndamento).toBeVisible()`
sem nenhum card dentro, à sua escolha.

Run: `npx playwright test e2e/tasks-kanban.spec.ts --project=chromium --reporter=line`
Expected: todos os testes do arquivo passam.

- [ ] **Step 9: Escrever e rodar o teste do toggle "Minhas tarefas" e dos selos de atraso/vencimento (Review Focus)**

Duas inserções diretas via o client Node `@supabase/supabase-js` (mesma
técnica já usada neste arquivo pra verificação, aqui usada pra
inserção — necessário porque a UI não tem como setar `due_date` no
passado nem `assigned_to` pra outro perfil que não o pré-selecionado, e
`status` só muda por drag):
1. Uma tarefa vinculada ao mesmo Contato do Step 1, `assigned_to` de
   QUALQUER `user_profiles.id` diferente do perfil de QA (consulta
   `user_profiles` pelo mesmo client, filtra `id != <id do perfil de
   QA>`, pega o primeiro — o projeto já tem múltiplos perfis seed pros
   testes de RLS por papel, não precisa criar um novo), `due_date` no
   futuro, `status = 'a_fazer'`.
2. Uma tarefa vinculada ao mesmo Contato, `assigned_to` do perfil de
   QA, `due_date` no passado (`now - 1 dia`), `status = 'concluida'`
   (concluída E atrasada — é exatamente o caso do Review Focus "selo
   não pode aparecer numa tarefa concluída").

Teste `"toggle 'Minhas tarefas' esconde tarefa de outro responsável;
selo de atraso não aparece em tarefa concluída"`: navega pra `/tasks`
(toggle desligado por padrão) — confirma que o card da tarefa 1
(outro responsável) está visível e que o card da tarefa 2 (concluída
+ atrasada) não mostra nenhum selo "Atrasada"/"Vence em breve". Liga o
toggle — confirma que o card da tarefa 1 desaparece. Desliga de volta —
confirma que reaparece (prova que o toggle é reversível e que
`columns` nunca perdeu a tarefa, só escondeu visualmente — ver Review
Focus "toggle não pode mudar o resultado de um drag").

Terceira inserção pro selo "Atrasada" sozinho: tarefa vinculada ao
Contato, `assigned_to` do perfil de QA, `due_date` no passado, `status
= 'a_fazer'` (atrasada, não concluída) — recarrega `/tasks`, confirma
que o card mostra o selo `t("urgencyOverdue")`.

Run: `npx playwright test e2e/tasks-kanban.spec.ts --project=chromium --reporter=line`
Expected: todos os testes do arquivo passam.

- [ ] **Step 10: Suíte E2E completa**

Run: `E2E_QA_EMAIL='qa@abvcap.com.br' E2E_QA_PASSWORD="$E2E_QA_PASSWORD" NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npx playwright test --reporter=line`
Expected: suíte inteira passa — nenhuma regressão em nenhum outro spec
(a sidebar ganhou um item novo, `tasks.spec.ts` continua intocado desde
a Task 1).

- [ ] **Step 11: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos.

- [ ] **Step 12: Commit**

```bash
git add src/app/"[locale]"/"(app)"/tasks e2e/tasks-kanban.spec.ts src/components/app-sidebar.tsx src/app/"[locale]"/"(app)"/layout.tsx src/messages/pt-BR.json src/messages/en-US.json
git commit -m "feat: quadro Kanban de Tarefas em /tasks"
```
