# Design: busca, filtros, ordenação e paginação no servidor (Contatos + Organizações)

## Contexto

Pedido do dono do projeto, depois de uma dúvida sobre robustez em produção
("quando eu estiver com a base em produção com milhares de contatos, a
aplicação vai ficar assim?"). Investigação confirmou um problema real de
arquitetura, não um bug pontual:

- `contacts/page.tsx` e `organizations/page.tsx` fazem `select("*")` sem
  `.range()`/`.limit()` — toda a tabela é baixada a cada carregamento da
  página, independente de quantas linhas existem.
- `ContactsTable`/`OrganizationsTable` filtram (busca, Tag, Cargo, Empresa,
  Tipo, Tier, Status, Setor) inteiramente em memória no navegador, sobre o
  array já carregado.
- `EntityDataGrid` (componente compartilhado pelas duas listas) pagina e
  ordena só no lado do cliente (TanStack Table local) — "página 2 de 50"
  na UI não significa que só a página 2 foi baixada; os dados inteiros já
  estão no navegador antes da paginação visual acontecer.

Escala alvo confirmada com o dono do projeto: centenas a poucos milhares de
registros (~5 mil) por entidade — não dezenas de milhares. Isso descarta a
necessidade de infraestrutura de busca full-text dedicada; filtro/busca via
SQL indexado no Postgres (via PostgREST) é suficiente.

Escopo confirmado: Contatos **e** Organizações juntos nesta frente, já que
compartilham o mesmo `EntityDataGrid` e o mesmo problema — resolver só uma
deixaria a outra pra trás com o mesmo defeito.

## Decisões já tomadas (brainstorming, 2026-10-03)

- Filtro, busca, ordenação e paginação passam a rodar no servidor (query no
  Supabase), não mais em memória no cliente.
- Estado dos filtros passa a viver na URL (`searchParams`), não em
  `useState` local — aplicar um filtro salvo vira navegar pra essa URL.
  Ganho colateral: link compartilhável/favoritável de uma visão filtrada.
- Busca por nome usa debounce (~350ms) antes de navegar, pra não disparar
  uma ida ao servidor a cada tecla digitada.
- Ordenação por E-mail (hoje client-side sobre `emails[0]`, um array) é
  **removida** — não há forma limpa de ordenar por um elemento de array via
  `.order()` do Supabase sem uma coluna/view computada à parte, e o ganho
  não justifica esse trabalho extra agora. Ordenação por Nome continua
  (coluna direta, já é a ordem padrão hoje).
- Fora de escopo: busca full-text dedicada (não necessário na escala
  confirmada), paginação/filtro de qualquer outra lista do app além de
  Contatos/Organizações (não existem outras hoje), mudança de paleta de
  filtros disponíveis (os filtros continuam os mesmos já existentes —
  Tag/Cargo/Empresa em Contatos, Tipo/Tier/Status/Setor em Organizações).

## Arquitetura

### Estado via URL

Cada filtro/busca/página/ordenação vira um parâmetro de `searchParams` na
própria rota da lista (`/contacts`, `/organizations`). Shape 1:1 com o
`ContactFilterState`/`OrganizationFilterState` que já existe hoje (mesmos
nomes de campo), mais `page` (1-based, default `1`), `sort` (nome da
coluna; default `full_name`) e `dir` (`"asc"` | `"desc"`; default `"asc"`
— mesma ordem padrão já usada hoje). Tamanho de página fixo em **10**
(mesmo default atual do `EntityDataGrid`, não configurável pelo usuário
nesta frente). Trocar um filtro ou página
navega (`router.push`/`replace`, raso — sem reload de documento completo)
pra URL nova; o Server Component da página lê `searchParams` e builda a
query. Aplicar um filtro salvo (`SavedFiltersControl`) passa a ser
literalmente montar a URL a partir do `filter_state` salvo e navegar — mais
simples que o `applyFilterState` client-side de hoje, não mais complexo.

### Query no servidor — Contatos

Em `contacts/page.tsx`, a partir de `searchParams`:

1. **Busca por nome**: `.ilike("full_name", `%${search}%`)`.
2. **Cargo**: `.eq("title", title)` — coluna direta.
3. **Empresa**: `organization_contacts` tem FK real (`contact_id`/`org_id`)
   — resolve a lista de `contact_id` com vínculo atual (`end_date is null`)
   naquela organização primeiro, depois `.in("id", contactIds)` na query de
   `contacts`. Mesma lógica de hoje (`organizationByContact`), só que roda
   ANTES da paginação, não depois de carregar tudo.
4. **Tag**: `entity_tags` é polimórfico (sem FK pro PostgREST inferir o
   relacionamento) — resolve o `tag_id` pelo nome em `tags`, depois os
   `entity_id` em `entity_tags` (`entity_type = 'contact'`), depois
   `.in("id", ...)` em `contacts`. Dois passos de query extras; irrelevante
   nessa escala.
5. **Ordenação**: `.order("full_name", { ascending })` — único campo
   ordenável (ver decisão sobre E-mail acima).
6. **Paginação**: `.select("*", { count: "exact" })` + `.range(from, to)` —
   o `count` vem na mesma chamada, sem query separada.

Os filtros de 2-4 combinam em AND entre si e com a busca por nome — mesma
semântica de hoje, só que cada um aplicado como filtro de banco (via lista
de ids resolvida antes) em vez de `.filter()` em JS.

### Query no servidor — Organizações

Mesmo princípio, mais simples: `org_type`/`tier`/`status` são colunas
diretas (`.eq()`), `priority_sectors` é array nativo na própria tabela
`organizations` (não polimórfico) — filtra direto com o operador de
contenção de array do Postgres (`.contains("priority_sectors", [sector])`),
sem passo de resolução prévia. Busca por nome e paginação/ordenação iguais
ao padrão de Contatos.

### `EntityDataGrid` — modo controlado

Hoje o componente é dono do próprio estado (`useState` de
`pagination`/`sorting`, TanStack Table calcula tudo sobre o array completo
recebido). Passa a receber `pagination`/`sorting` como props controladas
(vindas da URL) e `totalCount` (separado de `data.length`, que agora é só
o tamanho da página atual — 10-20 linhas). Internamente:
`manualPagination: true`, `manualSorting: true`, com `onPaginationChange`/
`onSortingChange` navegando via `router.push` em vez de só atualizar estado
local. `DataGridPagination` continua igual visualmente — só troca a fonte
dos números (`recordCount={totalCount}` em vez de `data.length`).

Mudança de contrato do componente compartilhado — ambas as tabelas (Contato
e Organização) migram juntas, na mesma leva, pro mesmo contrato novo.

## Fluxo de dados e testes

Nenhuma migration nova — todos os filtros já existem como colunas/tabelas
atuais, a mudança é só em COMO são consultados (servidor vs. cliente).

Testes E2E: o padrão já usado (nomes únicos com timestamp, busca pelo
prefixo único antes de verificar células) continua funcionando sem mudança
conceitual — o filtro roda antes da paginação no servidor, então buscar por
um prefixo único sempre retorna só as linhas daquele teste, independente de
quantos registros acumulados existem na base de QA. O que muda:
- Cada interação de filtro vira uma ida real ao servidor (não mais
  instantânea no cliente) — testes que já precisaram de
  `test.setTimeout(90_000)` por volume de passos continuam precisando;
  pode ser que mais alguns testes precisem da mesma folga.
- Debounce da busca (~350ms): `fill()` seguido de uma asserção continua
  funcionando sem mudança de código no teste, já que as asserções do
  Playwright re-tentam automaticamente — só não dá mais pra assumir
  resultado instantâneo síncrono.
- Qualquer teste que dependa de ver a lista inteira sem filtrar (se
  existir) passa a estar sujeito à paginação real — revisão necessária
  task a task durante a implementação.

## Fora de escopo

- Busca full-text dedicada (Postgres `tsvector`/extensões) — escala
  confirmada (~5 mil registros) não justifica agora; `ilike` indexado
  resolve.
- Ordenação por E-mail (ver decisão acima) — removida, não substituída por
  outra coluna computada nesta frente.
- Qualquer filtro novo além dos já existentes hoje em cada lista.
- Paginação/filtro de qualquer lista fora de Contatos/Organizações (não
  existem outras no momento).
- Infinite scroll ou virtualização — mantém paginação numerada por página,
  mesma UX visual de hoje, só a origem dos dados muda.
