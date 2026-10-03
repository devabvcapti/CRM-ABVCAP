# Design: limpeza de código morto + data-grid real em Contatos/Organizações

## Contexto

Auditoria completa do CRM (pedida pelo dono do projeto após uma sessão com
muitos erros de processo — ver `docs/roadmap.md` 2026-10-02, achado do
`PGRST116`) encontrou, via agente de exploração factual (sem opinião de
arquitetura, só leitura):

1. **2 páginas placeholder desatualizadas**: `/` (landing) e `/dashboard` —
   textos i18n ainda dizem "em construção"/"chega na Fase 1", mas essas
   fases já existiram.
2. **Componentes baixados sem uso em produção**:
   - `src/components/examples/` (40 arquivos `c-*.tsx`) — zero consumidor,
     **sem** isenção de lint/build (ao contrário de `reui/`/`charts/`),
     custando CI à toa.
   - `src/components/reui/` (data-grid 12 arquivos, gantt 9, kanban,
     sortable, phone-input, badge, frame) e `src/components/charts/`
     (~70 arquivos) — zero uso, mas instalados de propósito para fases
     futuras (já documentado no roadmap) e já isentos de lint.
   - 23 de 39 primitivos de `src/components/ui/` sem nenhum uso real.
3. **Tabelas de Contatos e Organizações escritas à mão** (`<Table>` básico,
   filtro client-side simples, sem paginação/ordenação de coluna) enquanto
   existe um `data-grid` completo parado sem uso — o achado mais concreto
   de "baixamos o componente, não usamos".
4. Comparação com `atomic-crm` (referência): padrão Lista→Detalhe→Editar já
   adotado (duas vezes). Lacunas restantes (deals, tasks, notas, import
   CSV, filtros salvos, dashboard de verdade) já estão no roadmap como
   "ainda não iniciado" — não são confusão, são fases futuras.
5. Sidebar: confirmado, fora de escopo, nenhuma mudança.

Decisões já tomadas com o dono do projeto (brainstorming, 2026-10-02):
- Código da aplicação primeiro, estrutura `.claude/`/tooling do Claude Code
  fica para depois (projeto separado).
- Remover `examples/`; manter `reui/`/`charts/` parados (fases futuras).
- Trocar as duas tabelas pelo `data-grid` **agora**.
- Abordagem: usar o `data-grid` do `reui`, só as partes necessárias
  (ordenação + paginação), **sem** seleção de célula, DnD de linha,
  virtualização ou toggle de visibilidade de coluna — YAGNI real.
- Resolver os 2 placeholders na mesma PR (ajuste pequeno, não justifica PR
  própria).

## Arquitetura

Novo componente compartilhado `src/components/shared/entity-data-grid.tsx`
— segundo uso real de `components/shared/` (o primeiro é
`interactions-timeline.tsx`). Recebe `columns` (ColumnDef do TanStack
Table) + `data` + `getRowHref(row)` via props; internamente monta
`useTable({ features: dataGridFeatures, columns, data, state: {pagination,
sorting}, onPaginationChange, onSortingChange })` e renderiza
`<DataGrid><DataGridContainer><DataGridScrollArea><DataGridTable
/></DataGridScrollArea></DataGridContainer><DataGridPagination /></DataGrid>`
— mesmo padrão de `src/components/examples/c-data-grid-8.tsx` (extraído
antes de apagar esse arquivo).

Cada página (`contacts-table.tsx`, `organizations-table.tsx`) continua dona
de: busca por nome (input acima do grid, filtro client-side — **sem**
mudança de comportamento), botão "Novo" + Sheet de criar, e suas próprias
`columns` (badges de tag, selects de tipo/status). Só a renderização da
lista em si passa a ser uma chamada ao `EntityDataGrid` compartilhado.

Confirmado via leitura de `data-grid-table.tsx`: usa `<table>`/`<tr>`/`<td>`
semânticos de verdade — só vira `role="grid"` se seleção de célula estiver
ligada (não estamos ligando). Locators de teste existentes
(`getByRole("cell"/"row")`) continuam funcionando sem alteração.

## Colunas

**Contatos**: Nome (avatar/iniciais + link pro detalhe, ordenável) · Cargo
(badges de tag, não ordenável — é array) · E-mail (ordenável) · Telefone
(não ordenável).

**Organizações**: Nome (link, ordenável) · Tipo (ordenável) · Tier (badge,
ordenável) · Status (badge, ordenável).

Sem toggle de visibilidade de coluna. Paginação com tamanho padrão de 10.

## Migração e testes

1. Construir `entity-data-grid.tsx`.
2. Migrar Contatos primeiro, rodar suíte E2E completa.
3. Migrar Organizações (replica o padrão já validado), rodar suíte E2E
   completa de novo.
4. Remover `src/components/examples/` só depois do padrão absorvido no
   `entity-data-grid.tsx`.
5. Corrigir os dois textos placeholder (`HomePage.status` em
   `src/messages/{pt-BR,en-US}.json`, `DashboardPage.placeholder` idem) —
   texto real refletindo o estado atual do projeto, não mudança de
   funcionalidade.

Testes existentes (`busca por nome filtra a lista` em ambos os specs)
devem continuar passando sem alteração.

## Fora de escopo (explícito)

- `reui/`/`charts/` continuam instalados e sem uso — fases futuras já
  documentadas, não remover agora.
- Estrutura `.claude/`/tooling do Claude Code (CLAUDE.local.md, settings,
  rules/, commands/, agents/, hooks/, converter `ai-context/skills/*.md`
  pra Skills de verdade) — projeto separado, decidido explicitamente.
- Qualquer feature nova inspirada no atomic-crm (deals, tasks, notas,
  import CSV, filtros salvos, dashboard real) — já roadmapadas como fases
  futuras, não fazem parte desta limpeza.
- Seleção de célula, drag-and-drop de linha, virtualização, visibilidade
  de coluna do `data-grid` — não resolvem problema concreto hoje.
