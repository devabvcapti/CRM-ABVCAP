"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { EntityDataGrid } from "@/components/shared/entity-data-grid";
import { SavedFiltersControl } from "@/components/shared/saved-filters-control";
import { Link, useRouter } from "@/i18n/navigation";
import type { Database } from "@/types/database";
import type { OrganizationFormState } from "./actions";
import { OrganizationForm } from "./organization-form";
import { ORG_TYPES, TIERS, STATUSES } from "./constants";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

// Shape exato do filter_state salvo em saved_filters para entity_type =
// "organization" — reflete 1:1 os 5 useState abaixo (busca + 4 dropdowns).
export type OrganizationFilterState = {
  search?: string;
  orgType?: string;
  tier?: string;
  status?: string;
  sector?: string;
};

// Sentinela só de UI pro item "Todos" do Select — nunca aparece em
// filter_state (lá, "sem filtro" é undefined, não essa string).
const ALL_FILTER_VALUE = "__all__";

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function OrganizationsTable({
  organizations,
  savedFilters,
}: {
  organizations: Organization[];
  savedFilters: { id: string; name: string; filter_state: OrganizationFilterState }[];
}) {
  const t = useTranslations("OrganizationsPage");
  const tSavedFilters = useTranslations("SavedFilters");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Nonce incrementado a cada abertura — ver ai-context/skills/08-testing-quality.md:
  // key por identidade não basta (duas criações seguidas cairiam na mesma key).
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState<string | undefined>(undefined);
  const [tierFilter, setTierFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [sectorFilter, setSectorFilter] = useState<string | undefined>(undefined);
  // Temporário (Task 1): `EntityDataGrid` virou controlado (ver
  // docs/superpowers/specs/2026-10-03-server-side-list-pagination-design.md)
  // e Organizações ainda não migrou pra busca/filtro/paginação no servidor
  // (Task 2, mesma frente) — pagination/sorting que antes viviam DENTRO do
  // grid agora precisam vir de algum lugar; aqui replicam exatamente o
  // mesmo comportamento client-side de antes, só realocado um nível acima.
  // Task 2 substitui isto por `useEntityListUrlState`.
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const sectorOptions = useMemo(
    () => Array.from(new Set(organizations.flatMap((o) => o.priority_sectors))).sort(),
    [organizations],
  );

  const currentFilterState: OrganizationFilterState = {
    search,
    orgType: orgTypeFilter,
    tier: tierFilter,
    status: statusFilter,
    sector: sectorFilter,
  };

  function applyFilterState(filterState: OrganizationFilterState) {
    setSearch(filterState.search ?? "");
    setOrgTypeFilter(filterState.orgType ?? undefined);
    setTierFilter(filterState.tier ?? undefined);
    setStatusFilter(filterState.status ?? undefined);
    setSectorFilter(filterState.sector ?? undefined);
  }

  // Filtro client-side sobre a lista já carregada — não é busca full-text no
  // banco (isso fica para quando houver volume real de organizações que
  // justifique). Os 4 critérios de dropdown combinam com a busca por nome em
  // AND (cada `if` abaixo descarta a linha, nunca inclui) — Tipo/Tier/Status
  // comparam por igualdade (valor único por organização), Setor por
  // `.includes()` (array — uma organização pode ter vários setores
  // prioritários).
  // Memoizado: EntityDataGrid reseta a paginação para a página 1 sempre que a
  // referência de `data` muda, e sem useMemo um re-render do pai (ex.: abrir
  // o Sheet de "Nova organização") recriava o array a cada vez, jogando o
  // usuário de volta à página 1 mesmo sem a busca ter mudado.
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter((organization) => {
        if (!organization.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
        if (orgTypeFilter && organization.org_type !== orgTypeFilter) return false;
        if (tierFilter && organization.tier !== tierFilter) return false;
        if (statusFilter && organization.status !== statusFilter) return false;
        if (sectorFilter && !organization.priority_sectors.includes(sectorFilter)) return false;
        return true;
      }),
    [organizations, search, orgTypeFilter, tierFilter, statusFilter, sectorFilter],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, Organization>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colName")} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/organizations/${row.original.id}`} className="font-medium">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "org_type",
        id: "type",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colType")} />
        ),
        enableSorting: true,
        cell: ({ row }) => t(`type${toPascalCase(row.original.org_type)}`),
      },
      {
        accessorKey: "tier",
        id: "tier",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colTier")} />
        ),
        enableSorting: true,
        cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>,
      },
      {
        accessorKey: "status",
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colStatus")} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.status === "ativo" ? "default" : "secondary"}>
            {t(`status${toPascalCase(row.original.status)}`)}
          </Badge>
        ),
      },
    ],
    [t],
  );

  function openCreate() {
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function handleSaved(state: OrganizationFormState) {
    setSheetOpen(false);
    // Criar sempre navega para o detalhe da nova organização — é lá que
    // ficam contatos vinculados, timeline de interações, editar e excluir.
    if (state.id) router.push(`/organizations/${state.id}`);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <Button onClick={openCreate}>
          <PlusIcon aria-hidden="true" />
          {t("newButton")}
        </Button>
      </div>

      {organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="max-w-sm"
          />

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-type-filter">{t("filterTypeLabel")}</Label>
              <Select
                value={orgTypeFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setOrgTypeFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
                }
              >
                <SelectTrigger id="org-type-filter" className="w-44">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== ALL_FILTER_VALUE
                        ? t(`type${toPascalCase(value)}`)
                        : tSavedFilters("filterAllOption")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    {tSavedFilters("filterAllOption")}
                  </SelectItem>
                  {ORG_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`type${toPascalCase(type)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="org-tier-filter">{t("filterTierLabel")}</Label>
              <Select
                value={tierFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setTierFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
                }
              >
                <SelectTrigger id="org-tier-filter" className="w-32">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== ALL_FILTER_VALUE ? value : tSavedFilters("filterAllOption")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    {tSavedFilters("filterAllOption")}
                  </SelectItem>
                  {TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="org-status-filter">{t("filterStatusLabel")}</Label>
              <Select
                value={statusFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setStatusFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
                }
              >
                <SelectTrigger id="org-status-filter" className="w-36">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== ALL_FILTER_VALUE
                        ? t(`status${toPascalCase(value)}`)
                        : tSavedFilters("filterAllOption")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    {tSavedFilters("filterAllOption")}
                  </SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status${toPascalCase(status)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="org-sector-filter">{t("filterSectorLabel")}</Label>
              <Select
                value={sectorFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setSectorFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
                }
              >
                <SelectTrigger id="org-sector-filter" className="w-44">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== ALL_FILTER_VALUE ? value : tSavedFilters("filterAllOption")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>
                    {tSavedFilters("filterAllOption")}
                  </SelectItem>
                  {sectorOptions.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SavedFiltersControl
            entityType="organization"
            savedFilters={savedFilters}
            currentFilterState={currentFilterState}
            onApply={applyFilterState}
          />

          <EntityDataGrid
            columns={columns}
            data={filteredOrganizations}
            getRowId={(organization) => organization.id}
            totalCount={filteredOrganizations.length}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
          />
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <OrganizationForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
