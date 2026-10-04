# Design: quadro Kanban de Tarefas (sub-projeto 2 de 4)

## Contexto

Segundo sub-projeto do backlog de Tarefas/Kanban/recorrência/notificações
(Fase 2 do roadmap, `docs/roadmap.md`), decomposto em brainstorming em
2026-10-04 por ser escopo grande demais pra uma spec só. O sub-projeto 1
(entidade Tarefa — criar/concluir/excluir, lista no detalhe de Contato/
Organização) já está em produção (`docs/superpowers/specs/
2026-10-04-tasks-entity-design.md`).

Hoje uma Tarefa só tem dois estados (`done_at` nulo ou preenchido —
pendente/concluída). Um quadro Kanban útil precisa de mais granularidade.

## Decisões já tomadas (brainstorming, 2026-10-04)

- **3 colunas fixas**: A Fazer / Em Andamento / Concluída — não só
  pendente/concluída.
- **`tasks` ganha uma coluna `status`** nova; `done_at` passa a ser
  **derivado** de `status` (nunca fonte de verdade independente): toda
  mudança de status para `'concluida'` seta `done_at = now()`; qualquer
  mudança saindo de `'concluida'` limpa `done_at = null`. Preserva o
  significado já existente de `done_at` ("quando foi concluída") sem
  duplicar a fonte de verdade.
- **Checkbox da lista existente** (`TasksList`, sub-projeto 1, já em
  produção) vira um atalho binário sobre `status`: marcar manda pra
  `'concluida'`, desmarcar manda de volta pra `'a_fazer'` — nunca passa
  por `'em_andamento'` por esse caminho. Só o Kanban expõe o estágio do
  meio. Decisão explícita: não transformar a lista existente num seletor
  de 3 estados, pra não mudar a UI que já está em produção.
- **Página nova `/tasks`**, item novo no menu lateral — mostra **todas**
  as tarefas do CRM, sem filtro por padrão (nem por responsável, nem por
  participante). "Minhas tarefas"/filtros ficam fora de escopo desta
  leva.
- Colunas do quadro **não são arrastáveis entre si** — só os cards de
  tarefa se movem entre colunas.
- **Mutação otimista**: arrastar um card atualiza a tela na hora, antes
  da confirmação do servidor; se a escrita falhar, desfaz visualmente e
  mostra erro (mesmo padrão de alerta já usado no resto do projeto).

## Arquitetura

### Migration (próxima: `0009`)

```sql
alter table crm_abvcap.tasks
  add column status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'concluida'));
```

Nenhuma mudança de RLS — a policy de UPDATE já existente
(`tasks_update_write_roles`, admin+gestor+analista) já cobre qualquer
coluna da linha, `status` incluso.

### Server Actions (`src/lib/actions/tasks.ts`)

- **`setTaskStatus(taskId, status)`** — nova. Escreve `status` e o
  `done_at` derivado numa única chamada (mesmo padrão de round-trip único
  já estabelecido em `deleteTask`/`setTaskDone` no sub-projeto 1:
  `.update({...}).eq("id", taskId).select("participant_type").single()`,
  onde `.single()` já detecta RLS bloqueando a escrita como erro).
- **`setTaskDone(taskId, done)` é removida** — duas Server Actions
  escrevendo nas mesmas duas colunas (`status`/`done_at`) seria duplicar
  a fonte de verdade. O checkbox da lista existente passa a chamar
  `setTaskStatus(taskId, done ? "concluida" : "a_fazer")` diretamente.

### Página `/tasks`

Novo item de menu em `src/components/app-sidebar.tsx` (grupo protegido
`(app)`, mesmo padrão de Dashboard/Contatos/Organizações). Server
Component busca todas as `tasks` + todos os `contacts`/`organizations`
(só `id`/nome) — mesma solução já usada em todo o projeto pra resolver
nome de um participante polimórfico sem FK (`entity_tags` segue o mesmo
padrão desde a Fase 1). Agrupa em `Record<"a_fazer" | "em_andamento" |
"concluida", TaskCard[]>` já no servidor.

Client Component usa o primitivo já vendorizado
`src/components/reui/kanban.tsx` (`Kanban`/`KanbanBoard`/`KanbanColumn`/
`KanbanItem`, nunca usado em produto real até agora) — ele já resolve
drag-and-drop com estado controlado (`value`/`onValueChange`) e um
callback `onValueCommit(value, meta)` que só dispara quando a posição
realmente muda, com `meta.previousValue` pronto pra rollback. Colunas não
ganham `KanbanColumnHandle` (não renderizado), o que as deixa não-
arrastáveis — só os itens (`KanbanItemHandle`) são.

Fluxo: arrastar um card → `onValueChange` já atualiza a tela (otimista,
nativo do componente) → `onValueCommit` dispara `setTaskStatus(taskId,
novoStatus)` → se der erro, `setColumns(meta.previousValue)` desfaz a UI
+ mostra o alerta padrão (`window.alert`, mesmo texto `errorGeneric` já
usado em todo o resto do projeto).

Cada card mostra: descrição, prazo, responsável, um link pro Contato/
Organização dono da tarefa (necessário aqui — diferente da lista
embutida no detalhe, o quadro agrega tarefas de todo mundo, então o
contexto do participante não é mais implícito), e um botão de excluir
(`deleteTask`, já existe desde o sub-projeto 1 — mesmo `window.confirm`
antes, mesmo padrão já usado na lista). Decisão: excluir fica disponível
direto no card (seria estranho precisar navegar até o Contato/
Organização só pra isso), mas **criar uma tarefa nova a partir do
Kanban fica fora de escopo** — exigiria um seletor de participante
(Contato ou Organização) que não existe em lugar nenhum hoje; criar
continua só a partir da página de detalhe de cada um.

## Fluxo de dados e testes

Nenhuma mudança de RLS. Nenhuma mudança na tabela `tasks` além da coluna
`status`.

Testes:
- pgTAP: estende `supabase/tests/tasks_rls.test.sql` (ou novo arquivo, a
  decidir no plano) com um caso cobrindo que o `check` constraint de
  `status` rejeita um valor fora dos 3 permitidos.
- E2E: tarefa criada no detalhe de um Contato aparece em "A Fazer" no
  Kanban; arrastar um card pra "Concluída" via `locator.dragTo()`
  (padrão nativo do Playwright) reflete no banco de verdade (mesma
  técnica de verificação direta via `@supabase/supabase-js`, já
  estabelecida no sub-projeto 1); o checkbox da lista existente
  (Contato/Organização) continua funcionando depois da migração pra
  `setTaskStatus` (teste de regressão).

## Fora de escopo

- Filtro por responsável ("minhas tarefas") ou qualquer outro filtro na
  página `/tasks` — mostra tudo, sempre, nesta leva.
- Reordenar tarefas DENTRO da mesma coluna (só a coluna/status importa;
  se o componente permitir reordenar visualmente dentro da coluna, isso
  não precisa persistir em nenhum campo novo — não existe conceito de
  "posição" na Tarefa).
- Recorrência (sub-projeto 3) e notificações (sub-projeto 4) — cada um
  com seu próprio spec/plano, não entram nesta implementação.
- Qualquer mudança no conjunto de colunas além das 3 fixas (sem colunas
  customizáveis pelo usuário).
- Editar uma tarefa a partir do card do Kanban (segue fora de escopo
  desde o sub-projeto 1 — só criar/mudar status/excluir).
