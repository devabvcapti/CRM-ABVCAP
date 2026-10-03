"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import type { DataGridI18nOverrides } from "@/components/reui/data-grid/data-grid-i18n";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";

// Data-grid de lista compartilhado entre entidades (Contatos, Organizações):
// modo controlado — paginação/ordenação vêm de fora (URL, via
// `useEntityListUrlState`) e a busca/filtro/paginação/ordenação de verdade
// rodam no servidor (ver docs/superpowers/specs/2026-10-03-server-side-list-
// pagination-design.md). Sem seleção de célula, DnD, virtualização ou toggle
// de visibilidade de coluna — essas features do registry `reui/data-grid`
// ficam de fora de propósito (YAGNI).
export function EntityDataGrid<TData extends object>({
  columns,
  data,
  getRowId,
  totalCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
}: {
  columns: ColumnDef<DataGridFeatures, TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  totalCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  const t = useTranslations("DataGrid");

  // Traduz todo o texto que o `reui/data-grid` renderiza por padrão em inglês
  // (ver ai-context/skills/05-i18n.md — nenhum texto hardcoded na UI). Cobre
  // o conjunto completo de labels do registry, não só os hoje renderizados
  // (paginação, estado vazio) — assim qualquer feature futura do grid
  // (seleção, menu de colunas, filtro de coluna) já herda a tradução, sem
  // precisar voltar aqui. Memoizado para não reconstruir o objeto a cada
  // render (o `DataGridProvider` lê `i18n` via ref, então isso é só higiene).
  const i18n = useMemo<DataGridI18nOverrides>(
    () => ({
      labels: {
        sortAscending: t("sortAscending"),
        sortDescending: t("sortDescending"),
        pinColumnStart: t("pinColumnStart"),
        pinColumnEnd: t("pinColumnEnd"),
        moveColumnStart: t("moveColumnStart"),
        moveColumnEnd: t("moveColumnEnd"),
        columnsMenu: t("columnsMenu"),
        unpinColumn: (title) => t("unpinColumn", { title }),
        toggleColumns: t("toggleColumns"),
        rowCreate: t("rowCreate"),
        pinRow: t("pinRow"),
        unpinRow: t("unpinRow"),
        selectRow: t("selectRow"),
        selectAll: t("selectAll"),
        expandRow: t("expandRow"),
        collapseRow: t("collapseRow"),
        dragToReorder: t("dragToReorder"),
        dragToReorderRow: t("dragToReorderRow"),
        reorderingUnavailable: t("reorderingUnavailable"),
        loading: t("loading"),
        empty: t("empty"),
        allRowsLoaded: t("allRowsLoaded"),
        rowsPerPage: t("rowsPerPage"),
        paginationInfo: ({ from, to, count }) =>
          t("paginationInfo", { from, to, count }),
        previousPage: t("previousPage"),
        nextPage: t("nextPage"),
        goToPage: (page) => t("goToPage", { page }),
        paginationEllipsis: t("paginationEllipsis"),
        filterSelectedCount: (count) => t("filterSelectedCount", { count }),
        filterNoResults: t("filterNoResults"),
        filterClear: t("filterClear"),
      },
    }),
    [t],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    getRowId,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
    state: {
      pagination,
      sorting,
    },
    onPaginationChange,
    onSortingChange,
  });

  return (
    <DataGrid
      table={table}
      recordCount={totalCount}
      tableLayout={{ headerBackground: false }}
      i18n={i18n}
    >
      <div className="w-full space-y-2.5">
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <DataGridPagination />
      </div>
    </DataGrid>
  );
}
