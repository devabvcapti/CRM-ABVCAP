# Design: entidade Tarefa (sub-projeto 1 de 4 — básico)

## Contexto

Pedido do dono do projeto, a partir dos prints de referência do `atomic-crm`
(seção "Tasks" no detalhe de um contato: lista de tarefas com checkbox,
descrição, data de vencimento, botão "+ Add task"). Corresponde à Fase 2 do
roadmap (`docs/roadmap.md`: "Tarefas com recorrência; Kanban com mutação
otimista; notificações"), que foi decomposta em 4 sub-projetos sequenciais
porque o escopo completo é grande demais pra uma spec só (brainstorming,
2026-10-04):

1. **Entidade Tarefa** (este spec) — schema + CRUD básico (criar, concluir,
   excluir) + lista anexada ao detalhe de Contato/Organização.
2. Kanban (visualização em quadro, drag-and-drop).
3. Recorrência (tarefas que se repetem).
4. Notificações (Realtime + Resend + Web Push).

Cada sub-projeto segue seu próprio ciclo spec → plano → implementação,
nesta ordem (cada um depende do anterior).

## Decisões já tomadas (brainstorming, 2026-10-04)

- Toda tarefa é **sempre vinculada** a um Contato ou uma Organização — não
  existe tarefa solta/geral nesta leva (decisão explícita; "a fazer" sem
  vínculo fica fora de escopo).
- Uma tarefa é de **um participante só** (ao contrário de `interactions`,
  que pode ter vários) — não precisa de tabela de participantes separada,
  `participant_type`/`participant_id` direto na própria linha.
- Campo **"Atribuída a"** (colaborador responsável, `user_profiles`),
  separado de "quem criou" — decisão explícita, pensando no Kanban do
  sub-projeto 2 (ex.: "minhas tarefas").
- **Sem** classificação de tipo (Ligar/E-mail/Reunião/A fazer, como o
  `atomic-crm` tem) — só descrição livre + data + status. Decisão explícita
  pela simplicidade.
- **Sem** `classification_level` (ao contrário de `interactions`) — tarefa
  não é um registro sensível tipo ata de reunião confidencial, segue o
  mesmo padrão simples de visibilidade de `contacts`/`organizations`
  (default-deny + papel), não a dimensão extra de confidencialidade por
  linha.
- Permissão de excluir: **Admin + Gestor** (não Analista/Leitura) — mesma
  regra de `organizations_delete_manager`, não a trava extra
  "só Admin" que `contacts` tem por ser direito ao esquecimento da LGPD
  (ADR-005); tarefa não é dado pessoal do titular.
  **Correção feita durante a escrita deste spec** (não durante o
  brainstorming): criar/concluir (insert/update) segue o padrão já
  estabelecido em `organizations`/`contacts` — Admin **+ Gestor + Analista**
  podem, não só Admin+Gestor como foi dito na apresentação do desenho em
  chat. Alinha com o padrão existente (`organizations_insert_write_roles`/
  `organizations_update_write_roles`, ambos com os 3 papéis) em vez de
  inventar uma regra nova sem motivo.
- Fora de escopo nesta leva: editar uma tarefa já criada (só criar/
  concluir/excluir); tipo/categoria; tarefa sem vínculo; Kanban;
  recorrência; notificações.

## Arquitetura

### Migration (próxima: `0008`)

Reaproveita o padrão polimórfico já resolvido em `interactions` (ver
`supabase/migrations/0003_crm_fase1_core.sql`), mas sem tabela de
participantes — um participante só por tarefa.

```sql
create table crm_abvcap.tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  participant_type text not null check (participant_type in ('contact', 'organization')),
  participant_id uuid not null,
  description text not null,
  due_date timestamptz not null,
  assigned_to uuid not null references crm_abvcap.user_profiles (id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.tasks is
  'Tarefa vinculada a um Contato ou Organização (participant_type polimórfico, sem tabela de participantes — uma tarefa é de um só). done_at null = pendente, timestamp = concluída (e quando). Sem classification_level: tarefa não é dado sensível como interactions.';

create index tasks_participant_lookup_idx
  on crm_abvcap.tasks (participant_type, participant_id);

create index tasks_due_date_idx on crm_abvcap.tasks (due_date);

create trigger set_updated_at
  before update on crm_abvcap.tasks
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.tasks enable row level security;

create policy tasks_select_authenticated
  on crm_abvcap.tasks
  for select
  to authenticated
  using (true);

create policy tasks_insert_write_roles
  on crm_abvcap.tasks
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy tasks_update_write_roles
  on crm_abvcap.tasks
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy tasks_delete_manager
  on crm_abvcap.tasks
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']));
```

`tasks_select_authenticated` segue o mesmo padrão simples de
`organizations`/`contacts` (sem a checagem extra de `classification_level`/
`has_grant` que `interactions`/`interaction_participants` têm) — qualquer
operador autenticado vê qualquer tarefa, decisão coerente com "tarefa não é
dado sensível" acima.

**Limpeza polimórfica**: `tasks` referencia `contacts`/`organizations` via
`participant_id` sem FK real (mesmo motivo de `entity_tags`/
`interaction_participants` — polimórfico). `deleteContact`/
`deleteOrganization` (`src/lib/supabase/polymorphic-cleanup.ts`) precisam
ganhar `tasks` na lista de tabelas limpas antes do delete, do contrário
excluir um Contato/Organização com tarefas pendentes deixa linhas órfãs
pra sempre (mesmo bug real já documentado no roadmap pra `entity_tags`/
`interaction_participants`, antes do helper existir — não repetir).

### UI

**Onde aparece**: nova seção "Tarefas" na barra lateral do detalhe de
Contato e de Organização — mesma área de Tags/Vínculos institucionais.
Componente compartilhado (`src/components/shared/tasks-list.tsx` +
`src/lib/actions/tasks.ts`), mesmo padrão já usado por
`InteractionsTimeline`/`createInteraction(participantType, participantId, ...)`
— um componente genérico, usado nas duas páginas sem duplicar código.

**Lista**: cada tarefa mostra checkbox (estado concluída/pendente),
descrição, data de vencimento formatada, e um botão de lixeira. Tarefas
concluídas continuam visíveis na lista (não somem), mas com estilo
diferenciado (ex.: texto riscado/esmaecido — mesmo espírito do
`getRowStatus`/badges "deleted" já usados em outros componentes do
projeto). Ordenação: pendentes primeiro (por `due_date` ascendente),
concluídas depois (por `done_at` descendente — mais recente primeiro).

**Criar**: form inline (mesmo padrão de "Registrar interação" —
`InteractionsTimeline`, sem `Sheet`) com 3 campos: Descrição (texto),
Data de vencimento (date/datetime, mesmo input de `occurred_at` em
interações), Atribuída a (`<Select>` dos `user_profiles` ativos,
pré-selecionado no perfil do usuário logado — `getCurrentProfile()`, já
existe — mas o usuário pode trocar antes de salvar).

**Concluir/reabrir**: clique no checkbox chama uma Server Action que
alterna `done_at` (`null` → `now()`, ou `now()` → `null` se já concluída)
— sem confirmação, ação reversível com um clique.

**Excluir**: botão de lixeira por linha, `window.confirm` antes (mesmo
padrão de `ContactTags`/vínculos institucionais).

## Fluxo de dados e testes

Server Actions (`src/lib/actions/tasks.ts`, mesmo arquivo/padrão de
`interactions.ts`):
- `createTask(participantType, participantId, { description, dueDate, assignedTo })`
- `toggleTaskDone(taskId)` — alterna `done_at`, sem parâmetro de valor (o
  Server Action lê o estado atual e inverte).
- `deleteTask(taskId)`

Testes:
- pgTAP: novo teste de RLS (`supabase/tests/tasks_rls.test.sql`), mesmo
  padrão dos já existentes (`organizations_rls.test.sql`,
  `contacts_rls.test.sql`, etc.) — confirma que Analista cria/conclui mas
  não exclui, Leitura só vê, insert com `participant_type` inválido falha
  no `check` constraint.
- E2E: estende `contacts.spec.ts`/`organizations.spec.ts` (ou um novo
  `tasks.spec.ts`, a decidir na escrita do plano) — criar tarefa a partir
  do detalhe de um Contato, concluir, reabrir, excluir; o mesmo ciclo a
  partir do detalhe de uma Organização; excluir um Contato/Organização com
  tarefa pendente não deixa linha órfã (prova a limpeza polimórfica).

## Fora de escopo

- Editar uma tarefa já criada (descrição/data/responsável) — só criar/
  concluir/excluir nesta leva.
- Tipo/categoria de tarefa (Ligar/E-mail/Reunião/A fazer).
- Tarefa sem vínculo a Contato/Organização ("a fazer" geral).
- Kanban (sub-projeto 2), recorrência (sub-projeto 3), notificações
  (sub-projeto 4) — cada um com seu próprio spec/plano, não entram nesta
  implementação.
- Tela própria de listagem de tarefas (ex.: "minhas tarefas", um dashboard
  de tarefas) — fica pro Kanban (sub-projeto 2), que é literalmente essa
  visão agregada.
