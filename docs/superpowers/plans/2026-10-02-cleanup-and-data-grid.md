# Limpeza de código morto + data-grid em Contatos/Organizações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as tabelas de Contatos e Organizações (hoje `<Table>` básico, sem ordenação/paginação) por um data-grid de verdade usando o componente `reui/data-grid` já baixado e nunca usado, e remover o código morto (`src/components/examples/`) e os dois textos placeholder desatualizados que a auditoria encontrou.

**Architecture:** Um componente compartilhado `src/components/shared/entity-data-grid.tsx` (segundo uso real de `components/shared/`) encapsula `useTable` (TanStack Table, via `dataGridFeatures` do reui) + `<DataGrid><DataGridContainer><DataGridScrollArea><DataGridTable/></DataGridScrollArea></DataGridContainer><DataGridPagination/></DataGrid>`, parametrizado por `columns`/`data`/`getRowId`. Cada página continua dona de suas próprias `columns` (badges, links, formatação) e do fluxo de criar (Sheet) — só a renderização da lista em si passa a chamar o wrapper.

**Tech Stack:** Next.js 16 App Router, `@tanstack/react-table` (via `reui/data-grid`), Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-10-02-cleanup-and-data-grid-design.md`

## Global Constraints

- Sem seleção de célula, drag-and-drop de linha, virtualização ou toggle de visibilidade de coluna no data-grid — só ordenação + paginação (spec, seção "Arquitetura").
- Busca por nome continua client-side, input acima do grid, sem mudança de comportamento (spec, seção "Colunas").
- `reui/gantt`, `reui/kanban`, `src/components/charts/` ficam parados, sem uso — não remover, não usar agora (spec, "Fora de escopo").
- Nenhuma mudança em `.claude/`/tooling do Claude Code, nenhuma feature nova (deals/tasks/notas/import/filtros salvos/dashboard real) — projeto separado (spec, "Fora de escopo").
- Toda tabela nova em `src/components/ui/` é gerada via CLI, nunca editada à mão (`ai-context/skills/04-ui-design-system.md`) — não aplicável aqui (estamos usando `reui/data-grid`, já existente, não gerando novo primitivo).
- Rodar a suíte E2E completa (`npx playwright test`) depois de CADA task que toca uma página real — nunca só a suíte parcial.

## Review Focus

- **Ordenação por coluna clicando no cabeçalho**: nenhum teste hoje exercita isso (é a funcionalidade nova que todo o projeto existe para entregar) — Task 1 e Task 2 adicionam asserção de ordenação aos testes de busca já existentes.
- **Colunas com accessor de array** (`emails`/`phones` em Contatos): comparar arrays diretamente quebra ordenação — usar `accessorFn` retornando string (primeiro item), não `accessorKey` bruto. Coberto pela asserção de ordenação da coluna E-mail na Task 1.
- **Badges de tag (Cargo) continuam aparecendo na lista** depois da migração — `tagsByContact` vem de fora da própria linha (`Record<string, string[]>`), não é um campo do objeto `Contact`; a coluna precisa ler esse mapa via closure, não via `accessorKey`. Task 1 adiciona uma asserção de badge visível na lista (hoje só existe asserção de tag na página de detalhe, não na lista).
- **Lista vazia continua mostrando a mensagem de "nenhum registro"**, não o data-grid quebrado com zero linhas — o guard `{list.length === 0 ? <p>...</p> : <EntityDataGrid/>}` existente é preservado, não substituído por lógica de empty-state dentro do wrapper. Verificado manualmente (sem registro criado) em cada task de migração — não há teste E2E de lista vazia hoje para nenhuma entidade (lacuna pré-existente, fora de escopo corrigir aqui).
- **Paginação não quebra com poucas linhas** (hoje só 1 registro real em cada tabela) — verificado manualmente via dev server depois de cada migração (sem seed de >10 linhas, não é um teste automatizável sem mudar dado de produção).

---

### Task 1: `EntityDataGrid` compartilhado + migração de Contatos

**Files:**
- Create: `src/components/shared/entity-data-grid.tsx`
- Modify: `src/app/[locale]/(app)/contacts/contacts-table.tsx`
- Modify: `e2e/contacts.spec.ts` (estende o teste de busca existente)

**Interfaces:**
- Consumes: `DataGrid`, `DataGridContainer`, `dataGridFeatures`, tipo `DataGridFeatures` de `@/components/reui/data-grid/data-grid`; `DataGridPagination` de `@/components/reui/data-grid/data-grid-pagination`; `DataGridScrollArea` de `@/components/reui/data-grid/data-grid-scroll-area`; `DataGridTable` de `@/components/reui/data-grid/data-grid-table`; `DataGridColumnHeader` de `@/components/reui/data-grid/data-grid-column-header` (padrão exato de uso em `src/components/examples/c-data-grid-8.tsx` — ler esse arquivo INTEIRO antes de escrever este task, ele é a referência viva, apagado só na Task 3); `ColumnDef`, `PaginationState`, `SortingState`, `useTable` de `@tanstack/react-table`.
- Produces: `EntityDataGrid<TData extends object>({ columns, data, getRowId }: { columns: ColumnDef<DataGridFeatures, TData>[]; data: TData[]; getRowId: (row: TData) => string })` — export nomeado de `src/components/shared/entity-data-grid.tsx`. Usado por Task 1 (Contatos) e Task 2 (Organizações).

- [ ] **Step 1: Ler `src/components/examples/c-data-grid-8.tsx` inteiro**

Esse arquivo é a referência viva do padrão `useTable` + `DataGrid` já funcionando no projeto (import de cada peça, estrutura de `columns`, estado de paginação/ordenação, JSX de montagem). Vai ser apagado na Task 3 — por isso precisa ser lido e entendido ANTES, não depois.

- [ ] **Step 2: Implementar `EntityDataGrid` em `src/components/shared/entity-data-grid.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";

export function EntityDataGrid<TData extends object>({
  columns,
  data,
  getRowId,
}: {
  columns: ColumnDef<DataGridFeatures, TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
}) {
  // corpo: pagination/sorting state (useState), useTable (mesma forma de
  // c-data-grid-8.tsx, sem getRowCanExpand/expandedContent — não usamos
  // linha expansível), JSX: <DataGrid table={table} recordCount={data.length}
  // tableLayout={{ headerBackground: false }}><div className="w-full
  // space-y-2.5"><DataGridContainer><DataGridScrollArea><DataGridTable
  // /></DataGridScrollArea></DataGridContainer><DataGridPagination
  // /></div></DataGrid>
}
```

Sem seleção de célula, DnD, virtualização, toggle de visibilidade de coluna
(Global Constraints) — não importar `data-grid-cell-selection`,
`data-grid-table-dnd*`, `data-grid-table-virtual` nem
`data-grid-column-visibility` aqui.

- [ ] **Step 3: Migrar `contacts-table.tsx` para usar `EntityDataGrid`**

Dentro do componente, construir `columns` via `useMemo<ColumnDef<DataGridFeatures, Contact>[]>` (depende de `tagsByContact` e `t`, então refaz quando qualquer um mudar):
- Coluna `name`: `accessorKey: "full_name"`, `id: "name"`, `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colName")} />`, `enableSorting: true`, `cell: ({ row }) => <div className="flex items-center gap-2"><Avatar className="size-6"><AvatarFallback>{initials(row.original.full_name)}</AvatarFallback></Avatar><Link href={`/contacts/${row.original.id}`} className="font-medium">{row.original.full_name}</Link></div>` — função `initials(name)` local, copiar exatamente de `src/app/[locale]/(app)/contacts/[id]/page.tsx:14-21`.
- Coluna `tags`: `id: "tags"`, `header: t("colTags")` (string simples, sem `DataGridColumnHeader` — não ordenável), `enableSorting: false`, `cell: ({ row }) => <div className="flex flex-wrap gap-1">{(tagsByContact[row.original.id] ?? []).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>`.
- Coluna `email`: `id: "email"`, `accessorFn: (row) => row.emails?.[0] ?? ""` (NÃO `accessorKey: "emails"` — ver Review Focus, comparar arrays quebra ordenação), `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colEmail")} />`, `enableSorting: true`, `cell: (info) => info.getValue() as string`.
- Coluna `phone`: `id: "phone"`, `accessorFn: (row) => row.phones?.[0] ?? ""`, `header: t("colPhone")`, `enableSorting: false`, `cell: (info) => info.getValue() as string`.

Substituir o bloco `<Table>...</Table>` inteiro (linhas 78-109 do arquivo
atual) por `<EntityDataGrid columns={columns} data={filteredContacts}
getRowId={(contact) => contact.id} />`. Manter o `<Input>` de busca acima,
sem mudança. Remover os imports de `@/components/ui/table` que deixarem de
ser usados.

- [ ] **Step 4: Rodar a suíte E2E completa**

Run: `npx playwright test` (com `E2E_QA_EMAIL`/`E2E_QA_PASSWORD` no
ambiente)
Expected: todos os testes existentes continuam passando (nenhuma mudança
de comportamento visível pros testes atuais — só a implementação da
lista mudou).

- [ ] **Step 5: Estender `e2e/contacts.spec.ts` com asserção de ordenação e de badge na lista**

No teste `"busca por nome filtra a lista"` (já cria `nameA`/`nameB`),
depois das asserções de busca existentes: limpar o campo de busca, clicar
no cabeçalho da coluna "Nome" (`page.getByRole("columnheader", { name:
"Nome" }).click()`), e assertar que a ordem das linhas mudou (comparar a
posição relativa de `nameA`/`nameB` via `page.getByRole("row")` antes e
depois do clique — ou, mais simples, clicar duas vezes e confirmar que a
segunda ordem é a inversa da primeira).

No teste `"criar navega para o detalhe; editar e excluir a partir de lá"`
(já preenche `#tags` com "Palestrante" na criação): depois de voltar pra
lista (ou navegar pra lista separadamente), assertar que a badge
"Palestrante" aparece numa `row` da lista, não só na página de detalhe.

- [ ] **Step 6: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo os dois novos assert
adicionados no Step 5.

- [ ] **Step 7: Verificar manualmente lista vazia e paginação**

Via dev server (`npm run dev` ou a suíte já builda via `webServer`), com
zero contatos: confirma que aparece `t("empty")`, não o grid quebrado. Com
os poucos contatos reais de hoje: confirma que o controle de paginação
aparece sem erro no console.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/entity-data-grid.tsx "src/app/[locale]/(app)/contacts/contacts-table.tsx" e2e/contacts.spec.ts
git commit -m "feat: EntityDataGrid compartilhado + Contatos usando data-grid de verdade"
```

---

### Task 2: Migrar Organizações para `EntityDataGrid`

**Files:**
- Modify: `src/app/[locale]/(app)/organizations/organizations-table.tsx`
- Modify: `e2e/organizations.spec.ts` (estende o teste de busca existente)

**Interfaces:**
- Consumes: `EntityDataGrid` (Task 1), `DataGridColumnHeader` (mesmo import de Task 1).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Construir `columns` em `organizations-table.tsx` via `useMemo`**

- Coluna `name`: `accessorKey: "name"`, `id: "name"`, `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colName")} />`, `enableSorting: true`, `cell: ({ row }) => <Link href={`/organizations/${row.original.id}`} className="font-medium">{row.original.name}</Link>` — SEM avatar (diferente de Contatos, spec seção 2 não pede avatar aqui).
- Coluna `type`: `accessorKey: "org_type"`, `id: "type"`, `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colType")} />`, `enableSorting: true`, `cell: ({ row }) => t(`type${toPascalCase(row.original.org_type)}`)` — `toPascalCase` já existe no arquivo (linha 25-30 atual), manter.
- Coluna `tier`: `accessorKey: "tier"`, `id: "tier"`, `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colTier")} />`, `enableSorting: true`, `cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>`.
- Coluna `status`: `accessorKey: "status"`, `id: "status"`, `header: ({ column }) => <DataGridColumnHeader column={column} title={t("colStatus")} />`, `enableSorting: true`, `cell: ({ row }) => <Badge variant={row.original.status === "ativo" ? "default" : "secondary"}>{t(`status${toPascalCase(row.original.status)}`)}</Badge>`.

- [ ] **Step 2: Substituir o bloco `<Table>` por `<EntityDataGrid>`**

Mesmo padrão da Task 1, Step 3: `<EntityDataGrid columns={columns}
data={filteredOrganizations} getRowId={(organization) => organization.id}
/>`, remover imports de `@/components/ui/table` não usados.

- [ ] **Step 3: Rodar a suíte E2E completa**

Run: `npx playwright test`
Expected: todos os testes existentes continuam passando.

- [ ] **Step 4: Estender `e2e/organizations.spec.ts` com asserção de ordenação**

Mesmo padrão da Task 1, Step 5, no teste `"busca por nome filtra a
lista"` (já cria `nameA`/`nameB`): clicar no cabeçalho "Nome" e confirmar
que a ordem muda.

- [ ] **Step 5: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo o novo assert do Step 4.

- [ ] **Step 6: Verificar manualmente lista vazia e paginação**

Mesmo processo da Task 1, Step 7, para Organizações.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[locale]/(app)/organizations/organizations-table.tsx" e2e/organizations.spec.ts
git commit -m "feat: Organizações usando o EntityDataGrid compartilhado"
```

---

### Task 3: Remover `src/components/examples/`

**Files:**
- Delete: `src/components/examples/` (40 arquivos `c-*.tsx`, incluindo `c-data-grid-8.tsx` já lido/absorvido na Task 1)

**Interfaces:**
- Consumes: confirmação da Task 1 Step 1 (padrão já extraído) e da Task 1/2 (nenhum outro arquivo do projeto importa `components/examples`, conforme a auditoria original — reconfirmar com grep antes de apagar).
- Produces: nada.

- [ ] **Step 1: Reconfirmar que nada importa `components/examples`**

Run: `grep -rn "components/examples" src/app/ src/components/shared/ src/components/ui/ 2>/dev/null`
Expected: nenhuma linha (zero resultados) — se aparecer algo, PARAR e
investigar antes de apagar.

- [ ] **Step 2: Apagar a pasta**

```bash
git rm -r src/components/examples
```

- [ ] **Step 3: Rodar lint e build**

Run: `npm run lint && npm run build`
Expected: ambos passam sem erro (o warning de `<img>` em
`c-data-grid-8.tsx` que aparecia antes desaparece junto, já que o arquivo
não existe mais).

- [ ] **Step 4: Rodar a suíte E2E completa**

Run: `npx playwright test`
Expected: todos os testes passam (nada no runtime depende desses
arquivos).

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove src/components/examples/ (sem uso, sem isenção de lint)"
```

---

### Task 4: Corrigir os dois textos placeholder desatualizados

**Files:**
- Modify: `src/messages/pt-BR.json` (chaves `HomePage.status`, `DashboardPage.placeholder`)
- Modify: `src/messages/en-US.json` (mesmas chaves)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Atualizar `HomePage.status` nos dois idiomas**

`pt-BR.json:5`: trocar `"Em construção — Fase 0: fundação técnica do
projeto."` por um texto que reflita o estado real (Fase 0 e Fase 1 já
entregues — ex.: `"CRM de relacionamento institucional — Contatos e
Organizações em produção."`, ajustar conforme o texto real combinado).
`en-US.json`: tradução equivalente.

- [ ] **Step 2: Atualizar `DashboardPage.placeholder` nos dois idiomas**

`pt-BR.json:23`: trocar `"As telas de Contatos e Organizações chegam na
Fase 1."` por um texto que não prometa algo já entregue (ex.: apontar pra
`/contacts` e `/organizations` nos links do menu, já que o dashboard em
si continua sem dado de negócio próprio — fora de escopo construir um
dashboard real aqui, spec seção "Fora de escopo"). `en-US.json`: tradução
equivalente.

- [ ] **Step 3: Verificar manualmente as duas páginas**

Via dev server, visitar `/` (deslogado) e `/dashboard` (logado) nos dois
idiomas, confirmar que o texto novo aparece e nenhum outro elemento
quebrou.

- [ ] **Step 4: Rodar lint e build**

Run: `npm run lint && npm run build`
Expected: ambos passam (mudança é só de conteúdo de string JSON).

- [ ] **Step 5: Commit**

```bash
git add src/messages/pt-BR.json src/messages/en-US.json
git commit -m "fix: atualiza textos placeholder desatualizados (HomePage, DashboardPage)"
```
