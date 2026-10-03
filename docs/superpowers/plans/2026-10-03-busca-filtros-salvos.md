# Busca + filtros salvos em Contatos/Organizações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtros estruturados (Tipo/Tier/Status/Setor em Organizações; Cargo/Empresa em Contatos) ao lado da busca por nome já existente, e permitir salvar/reaplicar/apagar combinações de busca+filtros por usuário.

**Architecture:** Tabela nova `crm_abvcap.saved_filters` (RLS por posse via `current_profile_id()`, genérica entre as duas entidades via `entity_type` + `filter_state` jsonb). Dois Server Actions (`saveFilter`/`deleteFilter`) e um componente client compartilhado `SavedFiltersControl` (aplicar/salvar/apagar), consumido por `OrganizationsTable` e `ContactsTable` do mesmo jeito que `EntityDataGrid` já é. Combinação de filtros continua client-side via `useMemo`, mesma arquitetura de busca já existente — só estende a condição.

**Tech Stack:** Next.js App Router (Server Actions, Server Components), Supabase (migration + RLS + pgTAP), next-intl, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-busca-filtros-salvos-design.md`

## Global Constraints

- Filtros salvos são pessoais — nunca compartilhados entre usuários (spec, "Contexto").
- `entity_type` só aceita `'contact'` ou `'organization'` (constraint do banco).
- RLS 100% baseada em posse via `crm_abvcap.current_profile_id()` — nunca `has_role()`, não é recurso sujeito a papel (spec, "Arquitetura").
- Nome de filtro duplicado (mesmo usuário + mesma entidade) é rejeitado pelo banco (`unique(user_profile_id, entity_type, name)`, erro `23505`) e traduzido num erro de formulário amigável — nunca sobrescreve silenciosamente (spec, "Arquitetura").
- Setor (Organizações) compara por "o array `priority_sectors` contém este valor"; todos os demais campos (Tipo/Tier/Status/Cargo/Empresa) comparam por igualdade (spec, "Fluxo de dados").
- Filtro de Empresa em Contatos considera só o vínculo **atual** (`organization_contacts.end_date is null`) — nunca histórico (spec, "Fora de escopo").
- Dropdowns ficam sempre visíveis ao lado da busca — não atrás de um botão "Filtros" (spec, "Contexto").
- Nenhum texto hardcoded na UI — toda string nova entra em `src/messages/pt-BR.json` e `src/messages/en-US.json`, sempre pareada (`ai-context/skills/05-i18n.md`).
- Rodar a suíte E2E completa (`npx playwright test`) depois de CADA task que toca uma página real — nunca só a suíte parcial.
- Fora de escopo (não implementar nesta plan): seleção múltipla de Setor; filtro de Contatos além de Cargo/Empresa; filtros compartilhados; importador CSV/XLSX; atendimento a titulares LGPD; qualquer mudança em `.claude/`/tooling.

## Review Focus

- **Nome de filtro salvo duplicado**: tentar salvar um segundo filtro com o mesmo nome (mesma entidade, mesmo usuário) deve mostrar um erro visível no formulário, não travar nem sobrescrever o filtro existente silenciosamente. Nenhum teste do dia a dia exercitaria isso sem ser pedido explicitamente — Task 2 adiciona esse caso.
- **Múltiplos filtros ativos ao mesmo tempo** (não só um por vez): um usuário realista combina busca + 2+ dropdowns simultaneamente (ex.: Tipo=Fundo de PE E Status=Ativo) — se a lógica E só for testada com um critério isolado, uma condição com `||` em vez de `&&` passaria despercebida. Task 2 e Task 3 testam pelo menos 2 critérios ativos ao mesmo tempo.
- **Setor/Empresa ausentes não quebram nada**: uma organização sem nenhum setor cadastrado (`priority_sectors` vazio) não pode quebrar o dropdown de Setor nem o filtro; um contato sem vínculo institucional atual não pode aparecer como se tivesse empresa, nem quebrar o filtro de Empresa. Task 2 testa Setor vazio; Task 3 testa Empresa ausente.
- **Filtro salvo referenciando um valor que não existe mais** (ex.: `orgId` de uma organização já excluída, ou um `sector`/`tag` que nenhuma organização/contato mais usa): aplicar esse filtro salvo não pode quebrar a tela. Coberto por construção, não por teste automatizado dedicado — todas as comparações do Step 4 (Task 2) e Step 3 (Task 3) são `===`/`.includes()` sobre valores primitivos, nunca um lookup num mapa que poderia retornar `undefined` e estourar; um valor obsoleto só resulta em "nenhuma linha bate", nunca em exceção. Mesmo raciocínio já aceito no plan anterior para "paginação com poucas linhas" (verificado por construção/manualmente, não automatizado) — não é uma lacuna, é a mesma classe de risco já calibrada como não-automatizável nesta base de código.
- **RLS cross-user**: um usuário não pode ler, editar nem apagar o filtro salvo de outro usuário, mesmo conhecendo o `id` da linha — não é só "a UI não mostra", é a policy do banco que tem que barrar. Task 1 testa isso via pgTAP (não dá pra testar via E2E com uma única conta de QA).

---

### Task 1: Tabela `saved_filters` + RLS + regenerar tipos

**Files:**
- Create: `supabase/migrations/0006_crm_saved_filters.sql`
- Create: `supabase/tests/saved_filters_rls.test.sql`
- Modify: `src/types/database.ts` (regenerado via CLI, não editado à mão)

**Interfaces:**
- Consumes: `crm_abvcap.user_profiles(id)`, `crm_abvcap.current_profile_id()` (já existem, `supabase/migrations/0001_crm_init.sql`).
- Produces: tabela `crm_abvcap.saved_filters(id uuid, user_profile_id uuid, entity_type text, name text, filter_state jsonb, created_at timestamptz)` com RLS — consumida por Task 2 e Task 3 via `Database["crm_abvcap"]["Tables"]["saved_filters"]["Row"]`.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0006_crm_saved_filters.sql`:

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

- [ ] **Step 2: Aplicar a migration**

Run: `supabase db push` (precisa de `SUPABASE_ACCESS_TOKEN` no ambiente, projeto já linkado)
Expected: migration `0006_crm_saved_filters` aplicada sem erro.

- [ ] **Step 3: Confirmar que o GRANT de `0002_crm_grants.sql` cobre a tabela nova**

Run: `curl` direto no REST com a anon key, `Accept-Profile: crm_abvcap`, `GET /saved_filters` — mesma verificação já feita para `organizations`/`contacts` em `docs/roadmap.md` (2026-10-02).
Expected: resposta vazia (`[]`), não `42501 permission denied` — grants de `0002` são `on all tables in schema`, cobrem tabela nova automaticamente, mas confirmar não custa (mesmo procedimento do log de 2026-10-02 no roadmap).

- [ ] **Step 4: Escrever o teste pgTAP**

`supabase/tests/saved_filters_rls.test.sql`, mesmo padrão de `supabase/tests/organizations_rls.test.sql` (fixtures de `auth.users`/`user_profiles`, `set local role`/`request.jwt.claim.sub`, `plan(N)`, `rollback` no final). Dois usuários de teste (papel irrelevante aqui — é posse, não papel). Casos:
1. Usuário A insere um `saved_filters` próprio — sucesso.
2. Usuário A lê o próprio filtro — aparece.
3. Usuário B (outro `user_profile_id`) tenta ler os filtros — `select count(*)` dá 0 (RLS filtra silenciosamente, não é erro, mesmo padrão de "anon vê zero" nas outras tabelas).
4. Usuário B tenta dar `update` numa linha do usuário A pelo `id` — `is_empty` (zero linhas afetadas, RLS barra via `using`).
5. Usuário B tenta `delete` numa linha do usuário A — `is_empty`.
6. Usuário A apaga o próprio filtro — sucesso, linha some.
7. Inserir dois filtros com o mesmo `(user_profile_id, entity_type, name)` — `throws_ok` com código `23505`.

`plan(7)` (ajustar se decompuser diferente, mas cobrir exatamente estes 7 casos).

- [ ] **Step 5: Rodar o teste pgTAP**

Run: aplicar o arquivo manualmente num client Postgres contra o projeto remoto (sem Docker local, mesmo processo documentado em `ai-context/skills/08-testing-quality.md` e usado em `organizations_rls.test.sql`/`contacts_rls.test.sql`), dentro de uma transação com `rollback` no final (já está no arquivo).
Expected: todos os 7 `ok`/`results_eq`/`is_empty`/`throws_ok` passam.

- [ ] **Step 6: Regenerar tipos TypeScript**

Run: `supabase gen types typescript --linked --schema crm_abvcap > src/types/database.ts` (mesmo comando usado em todas as migrations anteriores, ver `docs/roadmap.md`)
Expected: `Database["crm_abvcap"]["Tables"]["saved_filters"]` aparece no arquivo gerado, com `Row`/`Insert`/`Update` e os tipos corretos (`filter_state: Json`).

- [ ] **Step 7: Build e lint**

Run: `npm run lint && npm run build`
Expected: ambos passam (mudança é só migration + tipos gerados, nenhum código consumidor ainda).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0006_crm_saved_filters.sql supabase/tests/saved_filters_rls.test.sql src/types/database.ts
git commit -m "feat: tabela saved_filters com RLS por posse"
```

---

### Task 2: Server Actions + `SavedFiltersControl` + integração em Organizações

**Files:**
- Create: `src/lib/actions/saved-filters.ts`
- Create: `src/components/shared/saved-filters-control.tsx`
- Modify: `src/app/[locale]/(app)/organizations/page.tsx`
- Modify: `src/app/[locale]/(app)/organizations/organizations-table.tsx`
- Modify: `e2e/organizations.spec.ts`
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`

**Interfaces:**
- Consumes: `Database["crm_abvcap"]["Tables"]["saved_filters"]["Row"]` (Task 1).
- Produces:
  - `saveFilter(entityType: "contact" | "organization", filterState: Record<string, string | undefined>, prevState: SaveFilterState, formData: FormData): Promise<SaveFilterState>` — export nomeado de `src/lib/actions/saved-filters.ts`, usado com `.bind(null, entityType, filterState)` + `useActionState` (mesmo padrão de `updateOrganization` em `organization-form.tsx:40`). `SaveFilterState = { error: "required_name" | "duplicate_name" | "generic" | null; success?: boolean }`.
  - `deleteFilter(id: string): Promise<{ error: boolean }>` — chamado diretamente (sem `useActionState`), mesmo padrão de `deleteOrganization` em `organization-edit-delete.tsx:31-36`.
  - `SavedFiltersControl<TFilterState extends Record<string, string | undefined>>({ entityType, savedFilters, currentFilterState, onApply }: { entityType: "contact" | "organization"; savedFilters: { id: string; name: string; filter_state: TFilterState }[]; currentFilterState: TFilterState; onApply: (filterState: TFilterState) => void }): JSX.Element` — export nomeado de `src/components/shared/saved-filters-control.tsx`. Usado por Task 2 (Organizações) e Task 3 (Contatos).

- [ ] **Step 1: Implementar `saveFilter`/`deleteFilter` em `src/lib/actions/saved-filters.ts`**

```tsx
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";

const saveFilterSchema = z.object({ name: z.string().min(1) });

export type SaveFilterState = {
  error: "required_name" | "duplicate_name" | "generic" | null;
  success?: boolean;
};

export async function saveFilter(
  entityType: "contact" | "organization",
  filterState: Record<string, string | undefined>,
  _prevState: SaveFilterState,
  formData: FormData,
): Promise<SaveFilterState> {
  const parsed = saveFilterSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "required_name" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_filters").insert({
    user_profile_id: profile.id,
    entity_type: entityType,
    name: parsed.data.name,
    filter_state: filterState,
  });

  if (error?.code === "23505") return { error: "duplicate_name" };
  if (error) return { error: "generic" };

  revalidatePath("/[locale]/organizations", "page");
  revalidatePath("/[locale]/contacts", "page");
  return { error: null, success: true };
}

export async function deleteFilter(id: string): Promise<{ error: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("saved_filters").delete().eq("id", id);
  if (error) return { error: true };
  revalidatePath("/[locale]/organizations", "page");
  revalidatePath("/[locale]/contacts", "page");
  return { error: false };
}
```

`getCurrentProfile()` já existe (`src/lib/supabase/current-profile.ts`, usado em `dashboard/page.tsx`/`layout.tsx`) — não reimplementar a busca do perfil logado. Importante: a RLS de `user_profiles` (`user_profiles_select_authenticated`, `0001_crm_init.sql`) permite "qualquer autenticado lê qualquer perfil" (`using (auth.uid() is not null)`, sem filtro por dono) — por isso uma query de `user_profiles` sem `.eq("auth_id", ...)` retornaria várias linhas e quebraria um `.single()`; `getCurrentProfile()` já filtra certo (`.eq("auth_id", user.id).maybeSingle()`), por isso é obrigatório usá-lo aqui em vez de uma query ad-hoc.

- [ ] **Step 2: Implementar `SavedFiltersControl` em `src/components/shared/saved-filters-control.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { saveFilter, deleteFilter, type SaveFilterState } from "@/lib/actions/saved-filters";

// corpo: useState local pro Sheet de "salvar" (aberto/fechado) + useActionState
// com saveFilter.bind(null, entityType, currentFilterState) (mesmo padrão de
// organization-form.tsx:40) — form só com um <Input name="name">. Select
// (não Combobox — lista pessoal curta, YAGNI) listando savedFilters por
// nome; escolher um chama onApply(item.filter_state) e reseta o Select pro
// placeholder (não fica "preso" mostrando o nome escolhido, já que
// currentFilterState pode mudar depois via outros dropdowns). Botão de
// apagar por item: window.confirm (mesmo padrão de
// organization-edit-delete.tsx:31) → deleteFilter(id) → window.alert em
// caso de erro, igual o resto do CRUD do projeto.
```

Sem seleção múltipla, sem edição de filtro salvo (só criar com o estado atual e apagar) — YAGNI, nada disso foi pedido na spec.

- [ ] **Step 3: Adicionar chaves de i18n em `pt-BR.json`/`en-US.json`**

Namespace `SavedFilters` novo (compartilhado entre as duas páginas): algo como `title`/`selectPlaceholder`/`saveButton`/`saveDialogTitle`/`nameLabel`/`nameFieldRequired`/`nameFieldDuplicate`/`saveError`/`deleteConfirm`/`deleteError`. Mais `filterAllOption` (texto "Todos"/"All" reaproveitado pelos 4+2 dropdowns de Organizações/Contatos — não precisa de uma chave por dropdown). Em `OrganizationsPage`: `filterTypeLabel`/`filterTierLabel`/`filterStatusLabel`/`filterSectorLabel`. Texto exato é critério do implementador (tom institucional, igual o resto do arquivo) — sempre pareado pt-BR/en-US, nunca uma chave só num idioma.

- [ ] **Step 4: Adicionar os 4 dropdowns + `SavedFiltersControl` em `organizations-table.tsx`**

`useState` para cada dropdown (`orgTypeFilter`, `tierFilter`, `statusFilter`, `sectorFilter`, todos `string | undefined`, `undefined` = "Todos"). Opções de Setor: `useMemo(() => Array.from(new Set(organizations.flatMap(o => o.priority_sectors))).sort(), [organizations])`.

`filteredOrganizations` (já existe, `useMemo` com `[organizations, search]`) ganha os 4 critérios novos na mesma condição, dependências do `useMemo` viram `[organizations, search, orgTypeFilter, tierFilter, statusFilter, sectorFilter]`:

```tsx
organizations.filter((organization) => {
  if (!organization.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
  if (orgTypeFilter && organization.org_type !== orgTypeFilter) return false;
  if (tierFilter && organization.tier !== tierFilter) return false;
  if (statusFilter && organization.status !== statusFilter) return false;
  if (sectorFilter && !organization.priority_sectors.includes(sectorFilter)) return false;
  return true;
});
```

`currentFilterState` passado pro `SavedFiltersControl`: `{ search, orgType: orgTypeFilter, tier: tierFilter, status: statusFilter, sector: sectorFilter }` (shape exato do `filter_state` da spec). `onApply`: seta os 5 `useState` de uma vez a partir do objeto recebido (`search ?? ""`, demais `?? undefined`). A página (`page.tsx`) passa `savedFilters` (resultado de `select * from saved_filters where entity_type = 'organization'` — RLS já filtra por usuário, não precisa de `.eq`) como prop nova pro `OrganizationsTable`.

- [ ] **Step 5: Buscar `savedFilters` em `organizations/page.tsx`**

```tsx
const { data: savedFilters } = await supabase
  .from("saved_filters")
  .select("id, name, filter_state")
  .eq("entity_type", "organization");
```

Passar como prop `savedFilters={savedFilters ?? []}` pro `OrganizationsTable`.

- [ ] **Step 6: Rodar a suíte E2E completa**

Run: `npx playwright test` (com `E2E_QA_EMAIL`/`E2E_QA_PASSWORD`)
Expected: todos os testes existentes continuam passando.

- [ ] **Step 7: Estender `e2e/organizations.spec.ts`**

No teste de busca existente (ou um novo teste dedicado), depois das asserções já existentes:
1. Selecionar um Tipo específico no dropdown — confirmar que a lista só mostra organizações daquele tipo.
2. Com o Tipo ainda selecionado, selecionar também um Status — confirmar que a lista respeita os DOIS critérios ao mesmo tempo (Review Focus: múltiplos filtros simultâneos), não só o último aplicado.
3. Selecionar um Setor — confirmar que filtra corretamente mesmo com organizações sem nenhum setor cadastrado presentes na lista (Review Focus: Setor vazio não quebra).
4. Salvar o filtro atual com um nome único (timestamp, mesmo padrão de `nameA`/`nameB` já usado no arquivo) — confirmar que aparece no `SavedFiltersControl`.
5. Tentar salvar outro filtro com o MESMO nome — confirmar que aparece uma mensagem de erro visível, e que ainda existe só UM filtro salvo com aquele nome (Review Focus: nome duplicado).
6. Limpar todos os dropdowns, reaplicar o filtro salvo do passo 4 — confirmar que os valores voltam exatamente como estavam.
7. Apagar o filtro salvo — confirmar (com `window.confirm` mockado/aceito, mesmo padrão já usado em outros testes de exclusão do arquivo) que some do `SavedFiltersControl`.

- [ ] **Step 8: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo os novos do Step 7.

- [ ] **Step 9: Build e lint**

Run: `npm run lint && npm run build`
Expected: ambos passam.

- [ ] **Step 10: Commit**

```bash
git add src/lib/actions/saved-filters.ts src/components/shared/saved-filters-control.tsx "src/app/[locale]/(app)/organizations/page.tsx" "src/app/[locale]/(app)/organizations/organizations-table.tsx" e2e/organizations.spec.ts src/messages/pt-BR.json src/messages/en-US.json
git commit -m "feat: filtros + filtros salvos em Organizações"
```

---

### Task 3: Dropdowns + `SavedFiltersControl` em Contatos

**Files:**
- Modify: `src/app/[locale]/(app)/contacts/page.tsx`
- Modify: `src/app/[locale]/(app)/contacts/contacts-table.tsx`
- Modify: `e2e/contacts.spec.ts`
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`

**Interfaces:**
- Consumes: `SavedFiltersControl`, `saveFilter`, `deleteFilter` (Task 2).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Buscar `organizationByContact` e `savedFilters` em `contacts/page.tsx`**

Seguindo o padrão exato de `tagsByContact` já existente no mesmo arquivo (query separada + `for` montando um `Record`, não um embed do PostgREST):

```tsx
const organizationByContact: Record<string, { id: string; name: string }> = {};
if (contactIds.length > 0) {
  const { data: orgLinks } = await supabase
    .from("organization_contacts")
    .select("contact_id, organizations(id, name)")
    .is("end_date", null)
    .in("contact_id", contactIds);

  for (const link of orgLinks ?? []) {
    const org = link.organizations as { id: string; name: string } | null;
    if (!org) continue;
    organizationByContact[link.contact_id] = org;
  }
}

const { data: savedFilters } = await supabase
  .from("saved_filters")
  .select("id, name, filter_state")
  .eq("entity_type", "contact");
```

`organization_contacts.contact_id`/`org_id` são FK de verdade (ao contrário de `entity_tags`), então o embed `organizations(id, name)` do PostgREST funciona direto — diferente do comentário sobre `entity_tags` ser polimórfico. Se um contato tiver mais de um vínculo atual (tecnicamente possível pelo schema, incomum na prática), fica o último da lista — mesmo "último vence" que qualquer outro `Record` montado em loop, sem tratamento especial (não há pedido na spec pra lidar com múltiplos vínculos atuais simultâneos).

Passar `organizationByContact` e `savedFilters={savedFilters ?? []}` como props novas pro `ContactsTable`.

- [ ] **Step 2: Adicionar chaves de i18n em `pt-BR.json`/`en-US.json`**

Em `ContactsPage`: `filterTagLabel`/`filterCompanyLabel` (mesmo padrão do Step 3 da Task 2 — `filterAllOption` já existe desde lá, reaproveitar).

- [ ] **Step 3: Adicionar os 2 dropdowns + `SavedFiltersControl` em `contacts-table.tsx`**

`useState` para `tagFilter`/`companyFilter` (`string | undefined`). Opções de Cargo: já dá pra derivar de `tagsByContact` (`Array.from(new Set(Object.values(tagsByContact).flat())).sort()`). Opções de Empresa: `Array.from(new Map(Object.values(organizationByContact).map(org => [org.id, org])).values()).sort((a, b) => a.name.localeCompare(b.name))` (dedup por id, já que vários contatos podem compartilhar a mesma organização).

`filteredContacts` (já existe, `useMemo` com `[contacts, search]`) ganha os 2 critérios novos, dependências viram `[contacts, search, tagFilter, companyFilter]`:

```tsx
contacts.filter((contact) => {
  if (!contact.full_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
  if (tagFilter && !(tagsByContact[contact.id] ?? []).includes(tagFilter)) return false;
  if (companyFilter && organizationByContact[contact.id]?.id !== companyFilter) return false;
  return true;
});
```

`currentFilterState`: `{ search, tag: tagFilter, orgId: companyFilter }` (shape exato da spec — campo chama `orgId`, guarda o id da organização, não o nome). `onApply`: mesmo padrão da Task 2.

- [ ] **Step 4: Rodar a suíte E2E completa**

Run: `npx playwright test`
Expected: todos os testes existentes continuam passando.

- [ ] **Step 5: Estender `e2e/contacts.spec.ts`**

Mesmo padrão do Step 7 da Task 2, adaptado:
1. Selecionar uma tag específica — confirmar que a lista filtra.
2. Com a tag ainda selecionada, selecionar também uma Empresa — confirmar que os DOIS critérios combinam (Review Focus: múltiplos filtros simultâneos).
3. Confirmar que um contato sem vínculo institucional atual não aparece quando o filtro de Empresa está ativo, e que a tela não quebra com contatos "sem empresa" presentes na lista (Review Focus: Empresa ausente não quebra nada).
4. Salvar, tentar duplicar nome (erro visível), reaplicar, apagar — mesma sequência da Task 2 Step 7, itens 4-7.

- [ ] **Step 6: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo os novos do Step 5.

- [ ] **Step 7: Build e lint**

Run: `npm run lint && npm run build`
Expected: ambos passam.

- [ ] **Step 8: Commit**

```bash
git add "src/app/[locale]/(app)/contacts/page.tsx" "src/app/[locale]/(app)/contacts/contacts-table.tsx" e2e/contacts.spec.ts src/messages/pt-BR.json src/messages/en-US.json
git commit -m "feat: filtros + filtros salvos em Contatos"
```
