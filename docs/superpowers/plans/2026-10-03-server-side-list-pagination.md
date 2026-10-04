# Busca/filtro/ordenação/paginação no servidor (Contatos + Organizações) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as listas de Contatos e Organizações buscarem, filtrarem,
ordenarem e paginarem no servidor (Supabase/Postgres), em vez de carregar a
tabela inteira e processar tudo em memória no navegador.

**Architecture:** Estado de filtro/busca/ordenação/página/itens-por-página
passa a viver em `searchParams` da própria rota. O Server Component de cada
página lê `searchParams`, monta a query no Supabase (`.ilike()`, `.eq()`,
`.order()`, `.range()` + `count: "exact"`) e passa só a página atual pro
Client Component. `EntityDataGrid` (compartilhado pelas duas listas) passa
a operar em modo controlado (`manualPagination`/`manualSorting`), recebendo
paginação/ordenação como props vindas da URL em vez de gerenciar o próprio
estado. Um hook cliente compartilhado (`useEntityListUrlState`) concentra a
lógica de ler/escrever esses parâmetros de URL, usado pelas duas tabelas.

**Tech Stack:** Next.js 16 (App Router, Server Components, `searchParams`
assíncrono), Supabase (`@supabase/supabase-js` via PostgREST), TanStack
Table v9 (`manualPagination`/`manualSorting`), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-10-03-server-side-list-pagination-design.md`

## Global Constraints

- Paginação/busca/filtro/ordenação rodam inteiramente no servidor (query no
  Supabase) — nada de `.filter()`/`.sort()` em JavaScript sobre um array
  já carregado por completo.
- Parâmetros de URL, shape 1:1 com `ContactFilterState`/
  `OrganizationFilterState` já existentes (mesmos nomes de campo) mais:
  `page` (1-based, default `1`), `pageSize` (default `10`; valores válidos
  `5`/`10`/`25`/`50`/`100` — mesmos do seletor já existente no
  `DataGridPagination`), `sort` (nome de coluna; default `"full_name"` nas
  duas listas), `dir` (`"asc"` | `"desc"`; default `"asc"`).
- Qualquer mudança de busca, filtro, ordenação ou itens-por-página reseta
  `page` para `1` (decisão de implementação: a página antiga pode não
  existir mais sob o critério novo — não estava escrita no spec original,
  é a única leitura sem ambiguidade).
- Busca por nome: debounce de 350ms antes de navegar (não dispara uma
  navegação a cada tecla digitada).
- Ordenação por E-mail (coluna `email` de Contatos) é removida
  (`enableSorting: false`) — não há `.order()` limpo sobre `emails[0]`
  (array) sem coluna/view computada, fora de escopo. Nome continua
  ordenável nas duas listas; em Organizações, Tipo/Tier/Status também
  continuam ordenáveis (colunas diretas).
- `EntityDataGrid` migra inteiramente pra modo controlado — sem modo dual
  (não existe mais nenhum consumidor do modo antigo depois da Tarefa 2).
- As opções de cada dropdown de filtro (Tag/Cargo/Empresa em Contatos;
  Setor em Organizações) vêm de uma query própria sobre o catálogo
  completo, nunca derivadas da página atual carregada (ver Review Focus).
- Nenhuma migration nova — todos os filtros já são colunas/tabelas
  existentes.
- i18n: nenhuma string nova de UI nesta mudança (mecanismo de dados, não
  de interface) — nenhum texto hardcoded, convenção já estabelecida do
  projeto.

## Review Focus

- **Resetar para a página 1 ao mudar qualquer filtro/busca/ordenação/
  itens-por-página**: usuário na página 3 aplica um filtro que reduz o
  total para 1 página — sem o reset, fica numa página vazia ou inexistente
  silenciosamente. Testado na Tarefa 1.
- **Contagem e paginação refletem só os filtros ativos**: com um filtro
  ativo que reduz pra poucos registros, a paginação não pode continuar
  mostrando o total da tabela inteira sem filtro. Testado nas Tarefas 1/2.
- **Opções de dropdown vêm do catálogo completo, não da página carregada**:
  se a query de opções (Tag/Cargo/Empresa/Setor) for esquecida e alguém
  usar os dados já paginados por engano, o dropdown mostraria só os
  valores da página atual, quebrando silenciosamente em volume real.
  Testado nas Tarefas 1/2 (criar registros em páginas diferentes, confirmar
  que a opção aparece no dropdown mesmo sem estar na página 1).
- **Excluir um registro e checar ausência sem filtrar primeiro**: já existe
  um comentário no código reconhecendo esse risco
  (`organizations.spec.ts`, uso de `filterList` antes do `toHaveCount(0)`)
  — com paginação real, continua crítico: um item pode só não estar na
  página 1 por volume, mascarando uma falha real de exclusão como sucesso.
  Nenhuma tarefa nova precisa disso (os testes existentes já filtram antes
  de checar ausência); a Tarefa 1/2 só preserva esse padrão nos testes que
  tocar.
- **Filtro salvo aplicado a partir de uma página/ordenação diferente da
  atual**: aplicar um filtro salvo precisa navegar para o estado salvo
  (sem herdar `page`/`sort` da URL atual) — já coberto pelos testes
  existentes de filtros salvos, que a Tarefa 1/2 ajusta sem remover essa
  cobertura.

---

## Arquivos

- Criar: `src/components/shared/entity-list-url-state.ts` — hook cliente
  compartilhado que lê/escreve os parâmetros de URL (filtros + `page` +
  `pageSize` + `sort` + `dir`).
- Modificar: `src/components/shared/entity-data-grid.tsx` — modo
  controlado.
- Modificar: `src/app/[locale]/(app)/contacts/page.tsx` — query no
  servidor.
- Modificar: `src/app/[locale]/(app)/contacts/contacts-table.tsx` — usa o
  hook, passa props controladas pro `EntityDataGrid`.
- Modificar: `src/app/[locale]/(app)/organizations/page.tsx` — query no
  servidor.
- Modificar: `src/app/[locale]/(app)/organizations/organizations-table.tsx`
  — usa o hook, passa props controladas pro `EntityDataGrid`.
- Modificar: `e2e/contacts.spec.ts`, `e2e/organizations.spec.ts`.

---

### Task 1: `EntityDataGrid` controlado + Contatos no servidor

**Files:**
- Create: `src/components/shared/entity-list-url-state.ts`
- Modify: `src/components/shared/entity-data-grid.tsx`
- Modify: `src/app/[locale]/(app)/contacts/page.tsx`
- Modify: `src/app/[locale]/(app)/contacts/contacts-table.tsx`
- Test: `e2e/contacts.spec.ts`

**Interfaces:**
- Produces (usado pela Tarefa 2):
  - `useEntityListUrlState<TFilterState extends Record<string, string | undefined>>(filterKeys: (keyof TFilterState & string)[], defaults: { sort: string }): { filterState: TFilterState; page: number; pageSize: number; sort: string; dir: "asc" | "desc"; setFilterState: (next: TFilterState) => void; setPage: (page: number) => void; setPageSize: (size: number) => void; setSorting: (sort: string, dir: "asc" | "desc") => void }`
    em `src/components/shared/entity-list-url-state.ts`. `setFilterState`/
    `setPageSize`/`setSorting` sempre resetam `page` pra `1`; `setPage` só
    muda a página. Lê a URL atual via `useSearchParams()` (client hook,
    `next/navigation`), navega via `useRouter().push()` (de
    `@/i18n/navigation`, mesmo import já usado pelas tabelas hoje) com
    `scroll: false`.
  - `EntityDataGrid<TData extends object>` ganha 5 props novas,
    obrigatórias: `totalCount: number`, `pagination: PaginationState`,
    `onPaginationChange: OnChangeFn<PaginationState>`, `sorting:
    SortingState`, `onSortingChange: OnChangeFn<SortingState>`. Remove o
    `useState` interno de `pagination`/`sorting` — passam a vir só das
    props. `useTable()` ganha `manualPagination: true`, `manualSorting:
    true`, `pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize))`.
    `<DataGrid recordCount={...}>` passa a usar `totalCount` em vez de
    `data.length`.
- Consumes: nada de tarefas anteriores (primeira tarefa do plano).

- [ ] **Step 1: Escrever o teste E2E que prova que mudar um filtro reseta pra página 1**

Novo teste em `e2e/contacts.spec.ts` (mesmo padrão de nome único com
timestamp dos testes vizinhos): `"mudar o filtro de Empresa a partir da
página 2 volta pra página 1"`. Cria 11 contatos com o mesmo prefixo (mais
que 1 página de `pageSize` 10) numa Empresa A, mais 1 contato com o mesmo
prefixo numa Empresa B — todos via `createContactViaQuickForm`. Busca pelo
prefixo (12 resultados, 2 páginas), navega pra página 2 (botão "2" do
`DataGridPagination`), aplica o filtro de Empresa = Empresa A (reduz pra
11, ainda 2 páginas) e confirma que voltou pra página 1 — ex.: o nome
alfabeticamente primeiro do conjunto filtrado, que só aparece na página 1,
fica visível sem precisar clicar em "1" de novo.

- [ ] **Step 2: Rodar a suíte existente e confirmar que falha pelo motivo certo**

Run: `E2E_QA_EMAIL=... E2E_QA_PASSWORD=... npx playwright test e2e/contacts.spec.ts -g "volta pra página 1"`
Expected: FAIL — o filtro ainda é client-side, não há conceito de "página"
real na URL ainda pra essa asserção fazer sentido.

- [ ] **Step 3: Implementar `useEntityListUrlState` em `src/components/shared/entity-list-url-state.ts`**

Assinatura e contrato exatos no bloco Interfaces acima. Usa
`useSearchParams()`/`usePathname()` de `next/navigation` e `useRouter` de
`@/i18n/navigation` (mantém o roteamento ciente de locale já usado pelas
tabelas). `filterState` é montado lendo cada chave de `filterKeys` da URL
(valor ausente vira `undefined`, nunca string vazia). `page`/`pageSize`
fazem parse numérico com fallback pro default se ausente/inválido (nunca
`NaN` repassado adiante). `dir` só aceita `"asc"`/`"desc"`, qualquer outro
valor cai no default `"asc"`.

- [ ] **Step 4: Reescrever `EntityDataGrid` para modo controlado em `src/components/shared/entity-data-grid.tsx`**

Assinatura exata no bloco Interfaces. Remove os dois `useState` existentes
(`pagination`, `sorting`) e o cálculo de `recordCount={data.length}` no
JSX — troca por `recordCount={totalCount}`. `useTable()` ganha
`manualPagination`/`manualSorting`/`pageCount` conforme especificado;
`state: { pagination, sorting }` passa a referenciar as props, não mais o
state local; `onPaginationChange`/`onSortingChange` passam a ser as props
recebidas, não mais os setters do `useState` removido.

- [ ] **Step 5: Query no servidor em `src/app/[locale]/(app)/contacts/page.tsx`**

`export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> })`.
Parse dos parâmetros (`search`, `tag`, `title`, `orgId`, `page`,
`pageSize`, `sort`, `dir`) com os mesmos defaults do hook da Step 3 —
tratar cada valor como `string | undefined` (um `searchParams` pode vir
como array se repetido na URL; ignore além do primeiro valor ou normalize
pra string, decisão do implementador, sem quebrar em nenhum dos dois
casos).

Monta a query de `contacts` seguindo a spec (seção "Query no servidor —
Contatos"): resolve `contactIds` candidatos por Empresa (se `orgId`
presente, via `organization_contacts` com `end_date is null`) e por Tag
(se `tag` presente, via `tags` → `entity_tags` com `entity_type =
"contact"`) ANTES da query principal; aplica `.ilike("full_name", ...)`
se `search` presente, `.eq("title", title)` se `title` presente,
`.in("id", contactIds)` se algum dos dois filtros acima resolveu uma
lista; `.order(sort, { ascending: dir === "asc" })`; `.range(from, to)`
com `from = (page - 1) * pageSize`, `to = from + pageSize - 1`; `.select("*", { count: "exact" })`.

`tagsByContact`/`organizationByContact` (as duas queries e os dois objetos
montados a partir delas, hoje em `page.tsx`) são **removidos por completo**
— não existe mais coluna de Tag nem de Empresa na tabela de Contatos desde
a branch `cargo-tags-contato` (colunas hoje: Nome, Cargo, E-mail,
Telefone), então o único uso de ambos era alimentar `tagOptions`/
`companyOptions` do filtro client-side e o predicado de filtro em si —
os dois saem nesta tarefa (ver `tagOptions`/`companyOptions` novos,
abaixo, e a remoção do filtro client-side no Step 6).

Três queries NOVAS, separadas da query paginada principal, pro catálogo
completo de opções dos dropdowns (ver Review Focus — nunca derivar de
dados já paginados):
- `tagOptions`: `tags` → nomes distintos de tags com pelo menos um
  `entity_tags` de `entity_type = "contact"` (join/duas queries, mesma
  lógica de hoje, só que sobre TODOS os contatos, não só os carregados).
- `titleOptions`: `contacts.select("title")` sem paginação, dedupe em
  memória (`Set`), ignora `null` — payload leve (uma coluna só).
- `companyOptions`: `organization_contacts` com `end_date is null`,
  embed `organizations(id, name)`, dedupe por id — mesma lógica de hoje
  (`organizationByContact`), só que não mais escopada a `contactIds` da
  página.

- [ ] **Step 6: `ContactsTable` consome o hook e passa props controladas**

Em `contacts-table.tsx`: troca os `useState` de `search`/`tagFilter`/
`titleFilter`/`companyFilter` pelo retorno de `useEntityListUrlState`.
Input de busca ganha debounce de 350ms (`useEffect` com `setTimeout`,
limpo no cleanup) antes de chamar `setFilterState` — o campo continua
controlado localmente pro valor digitado aparecer sem atraso, só a
NAVEGAÇÃO é debounced. `tagOptions`/`titleOptions`/`companyOptions` vêm
de props novas da página (Step 5), não mais calculados em `useMemo` sobre
`tagsByContact`/`contacts`. `filteredContacts`/o `useMemo` de filtro
client-side inteiro É REMOVIDO — `contacts` (prop) já vem filtrado e
paginado do servidor, passa direto pro `EntityDataGrid` como `data`.
`currentFilterState`/`applyFilterState` (usados pelo
`SavedFiltersControl`) passam a vir do hook: `onApply` do
`SavedFiltersControl` vira `hookReturn.setFilterState`.
`EntityDataGrid` recebe `totalCount` (nova prop da página),
`pagination={{ pageIndex: page - 1, pageSize }}`,
`onPaginationChange` convertendo pra `setPage`/`setPageSize` do hook
(um `updater` de paginação pode ser função ou valor — resolver contra o
estado atual antes de decidir se foi `pageIndex` ou `pageSize` que
mudou), `sorting={[{ id: sort, desc: dir === "desc" }]}`,
`onSortingChange` convertendo pro `setSorting(sort, dir)` do hook.
Coluna `email` ganha `enableSorting: false`.

- [ ] **Step 7: Rodar o teste da Step 1 e confirmar que passa**

Run: `npx playwright test e2e/contacts.spec.ts -g "volta pra página 1"`
Expected: PASS

- [ ] **Step 8: Escrever teste de opções de dropdown vindas do catálogo completo**

Novo teste em `e2e/contacts.spec.ts`: cria 11+ contatos únicos (mais que 1
página) com uma Empresa nova, de forma que o 11º/12º fique fora da página
1 por ordem alfabética; sem aplicar nenhum filtro ainda, abre o dropdown
de Empresa e confirma que essa Empresa aparece como opção (prova que a
lista de opções não veio só da página 1 carregada).

- [ ] **Step 9: Rodar o teste da Step 8, implementar o que faltar, confirmar que passa**

Run: `npx playwright test e2e/contacts.spec.ts -g "<nome do teste da Step 8>"`
Expected: PASS

- [ ] **Step 10: Revisar cada teste existente de `e2e/contacts.spec.ts` contra o Review Focus**

Rodar a suíte inteira do arquivo e corrigir qualquer teste que quebrou por
causa da mudança de mecanismo (não de comportamento) — nomes de locators
(`#contact-title-filter` etc.) não mudam, mas timing (debounce + ida ao
servidor) pode exigir ajuste pontual. Qualquer teste que dependia de ver
a lista "sem filtrar" precisa ganhar uma busca/filtro antes de checar
presença/ausência (ver Review Focus).

Run: `npx playwright test e2e/contacts.spec.ts --reporter=line`
Expected: todos os testes do arquivo passam.

- [ ] **Step 11: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos (o build já cobre checagem de TypeScript).

- [ ] **Step 12: Commit**

```bash
git add src/components/shared/entity-list-url-state.ts src/components/shared/entity-data-grid.tsx src/app/"[locale]"/"(app)"/contacts/page.tsx src/app/"[locale]"/"(app)"/contacts/contacts-table.tsx e2e/contacts.spec.ts
git commit -m "feat: busca/filtro/ordenação/paginação de Contatos no servidor"
```

---

### Task 2: Organizações no servidor (reusa a Tarefa 1)

**Files:**
- Modify: `src/app/[locale]/(app)/organizations/page.tsx`
- Modify: `src/app/[locale]/(app)/organizations/organizations-table.tsx`
- Test: `e2e/organizations.spec.ts`

**Interfaces:**
- Consumes: `useEntityListUrlState` e o novo contrato controlado de
  `EntityDataGrid`, exatamente como definidos na Tarefa 1 — nenhuma
  mudança nesses dois arquivos nesta tarefa.
- Produces: nada (última tarefa do plano).

- [ ] **Step 1: Escrever teste E2E equivalente ao da Tarefa 1 (reset de página) pra Organizações**

Mesmo formato do Step 1 da Tarefa 1, adaptado pro filtro de Tipo (ou
Tier/Status/Setor) em vez de Empresa.

- [ ] **Step 2: Rodar e confirmar que falha pelo motivo certo**

Run: `npx playwright test e2e/organizations.spec.ts -g "<nome do teste>"`
Expected: FAIL

- [ ] **Step 3: Query no servidor em `organizations/page.tsx`**

Mesmo padrão do Step 5 da Tarefa 1, mais simples (sem passo de resolução
de ids — `org_type`/`tier`/`status` são `.eq()` direto, `sector` é
`.contains("priority_sectors", [sector])` nativo). `sectorOptions` (hoje
`Array.from(new Set(organizations.flatMap(...)))`) vira uma query própria
de catálogo completo (`organizations.select("priority_sectors")` sem
paginação, flatten + dedupe em memória — mesmo raciocínio do
`titleOptions` da Tarefa 1) em vez de derivada da página carregada.

- [ ] **Step 4: `OrganizationsTable` consome o hook e passa props controladas**

Mesmo padrão do Step 6 da Tarefa 1: troca os 5 `useState` de
busca/4-filtros pelo hook, remove o `useMemo` de filtro client-side
inteiro, `EntityDataGrid` recebe `totalCount`/`pagination`/
`onPaginationChange`/`sorting`/`onSortingChange` do mesmo jeito.

- [ ] **Step 5: Rodar o teste da Step 1 e confirmar que passa**

Run: `npx playwright test e2e/organizations.spec.ts -g "<nome do teste>"`
Expected: PASS

- [ ] **Step 6: Escrever e rodar o teste de opções de dropdown do catálogo completo (Setor)**

Mesmo padrão do Step 8/9 da Tarefa 1, adaptado pra `priority_sectors`.

Run: `npx playwright test e2e/organizations.spec.ts -g "<nome do teste>"`
Expected: PASS

- [ ] **Step 7: Revisar cada teste existente de `e2e/organizations.spec.ts` contra o Review Focus**

Mesmo processo do Step 10 da Tarefa 1.

Run: `npx playwright test e2e/organizations.spec.ts --reporter=line`
Expected: todos os testes do arquivo passam.

- [ ] **Step 8: Suíte E2E completa (os dois arquivos + resto do projeto)**

Run: `npx playwright test --reporter=line`
Expected: suíte inteira passa (nenhuma regressão em
`organization-contact-links.spec.ts`/`organization-links.spec.ts`, que
também navegam pelas duas listas).

- [ ] **Step 9: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos limpos.

- [ ] **Step 10: Commit**

```bash
git add src/app/"[locale]"/"(app)"/organizations/page.tsx src/app/"[locale]"/"(app)"/organizations/organizations-table.tsx e2e/organizations.spec.ts
git commit -m "feat: busca/filtro/ordenação/paginação de Organizações no servidor"
```
