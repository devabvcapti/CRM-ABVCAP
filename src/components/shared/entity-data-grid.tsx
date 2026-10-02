"use client";

import { useState } from "react";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";

// Data-grid de lista compartilhado entre entidades (Contatos, Organizações):
// paginação + ordenação client-side sobre os dados já carregados, sem seleção
// de célula, DnD, virtualização ou toggle de visibilidade de coluna — essas
// features do registry `reui/data-grid` ficam de fora de propósito (YAGNI).
export function EntityDataGrid<TData extends object>({
  columns,
  data,
  getRowId,
}: {
  columns: ColumnDef<DataGridFeatures, TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    pageCount: Math.ceil((data?.length || 0) / pagination.pageSize),
    getRowId,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  return (
    <DataGrid
      table={table}
      recordCount={data.length}
      tableLayout={{ headerBackground: false }}
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
