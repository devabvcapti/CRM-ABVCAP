# Design: busca + filtros salvos em Contatos/Organizações

## Contexto

Primeiro sub-projeto da Fase 1 pendente (ver `docs/roadmap.md`, linha 33 —
"🟡 Em andamento": busca + filtros salvos; importador CSV/XLSX; atendimento
a titulares LGPD — os outros dois ficam para depois, cada um com seu
próprio ciclo spec→plano→implementação).

Hoje Contatos e Organizações têm só busca client-side por nome (`<Input>`
acima do `EntityDataGrid`, filtro simples por `includes()`), sem nenhum
filtro estruturado por campo e sem persistência — toda vez que o usuário
sai da tela, perde o que tinha filtrado.

Decisões já tomadas com o dono do projeto (brainstorming, 2026-10-03):
- Filtros salvos são **pessoais** (um usuário não vê os filtros salvos de
  outro) — mais simples de modelar e sem necessidade de decidir permissão
  de edição cruzada.
- Campos filtráveis: **Organizações** — Tipo, Tier, Status (já existem como
  coluna/badge na listagem hoje). **Contatos** — Cargo (tag), derivado do
  mesmo mapa `tagsByContact` que já alimenta os badges da lista. Nenhum
  campo novo exposto nesta rodada (ficam fora: Setores de Organizações —
  é array, exigiria UI de seleção múltipla; qualquer campo de Contatos além
  de Cargo).
- UI: dropdowns inline ao lado da busca (sempre visíveis), não um painel
  escondido atrás de um botão "Filtros".
- Um "filtro salvo" guarda o estado completo da tela: busca por nome + até
  3 (Organizações) ou 1 (Contatos) seleções de dropdown — nunca parcial.
- Persistência: tabela nova `crm_abvcap.saved_filters`, genérica entre as
  duas entidades via discriminador `entity_type` + blob `filter_state`
  jsonb — mesmo padrão polimórfico que o projeto já usa em `tags`/
  `entity_tags` (ver `ai-context/domain-glossary.md`), em vez de duas
  tabelas tipadas separadas ou um campo solto em `user_profiles`.

## Arquitetura

Nova migration `supabase/migrations/0005_crm_saved_filters.sql`:

```sql
create table crm_abvcap.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references crm_abvcap.user_profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'organization')),
  name text not null,
  filter_state jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_profile_id, entity_type, name)
);

alter table crm_abvcap.saved_filters enable row level security;

create policy saved_filters_select_own
  on crm_abvcap.saved_filters for select to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_insert_own
  on crm_abvcap.saved_filters for insert to authenticated
  with check (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_update_own
  on crm_abvcap.saved_filters for update to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id())
  with check (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_delete_own
  on crm_abvcap.saved_filters for delete to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id());
```

`filter_state` para Organizações: `{ search?: string, orgType?: string,
tier?: string, status?: string }`. Para Contatos: `{ search?: string, tag?:
string }`. Campo ausente/vazio = "sem filtro nesse campo". Nenhum `has_role`
envolvido — é dado pessoal do próprio colaborador, igual uma preferência de
UI, não um recurso de negócio sujeito a controle de papel.

O índice único `(user_profile_id, entity_type, name)` impede duas
visualizações com o mesmo nome para o mesmo usuário na mesma entidade —
tentar salvar um nome repetido é rejeitado pelo banco (`23505`), traduzido
pela Server Action num erro de formulário amigável, nunca sobrescreve
silenciosamente.

## Componentes

**Organizações** (`organizations-table.tsx`): três `<Select>` novos (Tipo,
Tier, Status) ao lado do `<Input>` de busca existente, cada um com uma
opção "Todos" que remove aquele filtro. Mesma estética dos selects já
usados no formulário de criar/editar.

**Contatos** (`contacts-table.tsx`): um `<Select>` (Cargo), com as opções
sendo a lista de tags distintas já presentes em `tagsByContact` (sem query
nova — é client-side sobre um dado que a página já carrega).

**`SavedFiltersControl`** (novo, `src/components/shared/saved-filters-control.tsx`,
compartilhado entre as duas páginas — mesmo espírito de reuso do
`EntityDataGrid`): recebe `entityType`, a lista de filtros salvos do
usuário para aquela entidade (prop, carregada no Server Component da
página), o estado atual da tela (busca + valores dos dropdowns) e
callbacks `onApply(filterState)` / `onSave(name)` / `onDelete(id)`.
Renderiza um combobox com os filtros salvos (selecionar um chama
`onApply` com o `filter_state` daquele item) + botão "Salvar filtro atual"
que abre um `Dialog` só com campo "Nome" (os demais valores vêm do estado
atual, não precisa redigitar) + ícone de apagar por item (com
confirmação, mesmo padrão já usado para excluir contato/organização).

**Server Actions novas** (`src/lib/actions/saved-filters.ts`):
`saveFilter(entityType, name, filterState)` e `deleteFilter(id)` — mesmo
padrão `useActionState` + Zod + `revalidatePath` já usado em todo o resto
do CRUD do projeto.

## Fluxo de dados e testes

Busca + todos os dropdowns ativos combinam com lógica **E** (todos os
critérios ativos precisam bater), calculado client-side via `useMemo` —
extensão direta do `filteredContacts`/`filteredOrganizations` que já
existe hoje (ver `src/app/[locale]/(app)/contacts/contacts-table.tsx` e
o equivalente de Organizações), incorporando os campos novos na mesma
condição, sem mudar a arquitetura de busca client-side existente.
Escolher um filtro salvo sobrescreve de uma vez a busca + todos os
dropdowns com os valores daquele `filter_state`. Sem filtros salvos: o
combobox fica vazio/com placeholder, sem componente de estado vazio
dedicado.

Testes:
- `supabase/tests/saved_filters_rls.test.sql` (pgTAP) — mesmo padrão de
  `organizations_rls.test.sql`/`contacts_rls.test.sql` (transação com
  rollback contra o banco remoto, sem Docker local): usuário só
  enxerga/insere/edita/apaga as próprias linhas.
- E2E (Playwright) — estende `e2e/organizations.spec.ts` e
  `e2e/contacts.spec.ts`: aplicar um dropdown e confirmar que a lista
  filtra; salvar um filtro, confirmar que aparece no combobox e que
  reaplicá-lo restaura busca+dropdowns; apagar e confirmar que some.

## Fora de escopo

- Filtro por Setores (Organizações) — campo array, exigiria seleção
  múltipla e lógica "contém algum destes"; fica para quando a necessidade
  aparecer.
- Filtros de Contatos além de Cargo.
- Filtros compartilhados entre usuários.
- Importador CSV/XLSX e atendimento a titulares LGPD — sub-projetos
  próprios, cada um com seu próprio ciclo spec→plano→implementação (ver
  decomposição em `docs/roadmap.md`).
- Qualquer mudança na estrutura `.claude/`/tooling do Claude Code
  (Track A, projeto separado, adiado).
