"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef, PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { EntityDataGrid } from "@/components/shared/entity-data-grid";
import { useEntityListUrlState } from "@/components/shared/entity-list-url-state";
import { SavedFiltersControl } from "@/components/shared/saved-filters-control";
import { Link, useRouter } from "@/i18n/navigation";
import type { Database } from "@/types/database";
import type { OrganizationFormState } from "./actions";
import { OrganizationForm } from "./organization-form";
import { ORG_TYPES, TIERS, STATUSES } from "./constants";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

// Shape exato do filter_state salvo em saved_filters para entity_type =
// "organization" — reflete 1:1 os campos de busca/filtro geridos pelo hook
// `useEntityListUrlState` abaixo.
export type OrganizationFilterState = {
  search?: string;
  orgType?: string;
  tier?: string;
  status?: string;
  sector?: string;
};

// Referência estável (módulo, não recriado a cada render) — evita que o
// useMemo interno de useEntityListUrlState recalcule por uma nova identidade
// de array a cada render do componente.
const ORGANIZATION_FILTER_KEYS: (keyof OrganizationFilterState & string)[] = [
  "search",
  "orgType",
  "tier",
  "status",
  "sector",
];

const DEFAULT_SORT = "name";
const SEARCH_DEBOUNCE_MS = 350;

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
  totalCount,
  sectorOptions,
  savedFilters,
}: {
  organizations: Organization[];
  totalCount: number;
  sectorOptions: string[];
  savedFilters: { id: string; name: string; filter_state: OrganizationFilterState }[];
}) {
  const t = useTranslations("OrganizationsPage");
  const tSavedFilters = useTranslations("SavedFilters");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Nonce incrementado a cada abertura — ver ai-context/skills/08-testing-quality.md:
  // key por identidade não basta (duas criações seguidas cairiam na mesma key).
  const [formKey, setFormKey] = useState(0);

  const {
    filterState,
    page,
    pageSize,
    sort,
    dir,
    setFilterState,
    updateFilterKey,
    setPage,
    setPageSize,
    setSorting,
  } = useEntityListUrlState<OrganizationFilterState>(ORGANIZATION_FILTER_KEYS, {
    sort: DEFAULT_SORT,
  });

  // Busca com debounce (350ms) antes de navegar — o campo em si continua
  // controlado localmente pro valor digitado aparecer sem atraso; só a
  // NAVEGAÇÃO (e portanto a ida ao servidor) é adiada. Mesmo padrão de
  // ContactsTable (Tarefa 1), inclusive a correção de corrida da busca
  // debounced (ver 806cb60): o eco da navegação que o próprio componente
  // disparou não pode sobrescrever teclas mais recentes digitadas enquanto
  // essa navegação ainda estava em voo.
  const [searchInput, setSearchInput] = useState(filterState.search ?? "");
  // "Latest ref" só pro callback do debounce (abaixo) ler o filterState mais
  // recente sem precisar reiniciar o timer a cada troca de tipo/tier/status/
  // setor — mutação sempre dentro de efeito, nunca durante o render, e nunca
  // LIDO durante o render tampouco (ver react-hooks/refs — a regra proíbe os
  // dois).
  const filterStateRef = useRef(filterState);
  useEffect(() => {
    filterStateRef.current = filterState;
  }, [filterState]);

  // Último valor de busca "conhecido" (da URL) — estado, não ref, porque É
  // lido durante o render (refs não podem). Distingue "a URL mudou porque a
  // navegação que eu mesmo disparei (debounce) terminou" (não deve
  // sobrescrever o campo: sob latência real, o usuário pode já ter digitado
  // mais teclas enquanto essa navegação estava em voo) de "a URL mudou por
  // outro motivo" (filtro salvo aplicado, navegação back/forward — aí sim
  // precisa adotar o valor novo no campo). Atualizado em dois lugares, nenhum
  // deles durante o render: otimisticamente no próprio debounce (abaixo, já
  // dentro de um `setTimeout`) e reconciliado no bloco de ajuste de estado
  // logo adiante (que roda durante o render, mas chamar um setState ali é o
  // padrão sancionado pelo React para "estado derivado de uma prop que
  // mudou" — diferente de mutar/ler um ref).
  const [lastPushedSearch, setLastPushedSearch] = useState(filterState.search);

  // Sincroniza o campo local quando filterState.search muda por fora — ajuste
  // de estado durante o render (padrão recomendado pelo React pra "estado
  // derivado de uma prop que mudou"), não um useEffect com setState síncrono,
  // que dispararia re-renders em cascata.
  const [syncedUrlSearch, setSyncedUrlSearch] = useState(filterState.search);
  if (filterState.search !== syncedUrlSearch) {
    setSyncedUrlSearch(filterState.search);
    if (filterState.search !== lastPushedSearch) {
      setSearchInput(filterState.search ?? "");
    }
    // Reconcilia independente da causa (eco do nosso próprio debounce ou
    // mudança externa) — garante que a PRÓXIMA comparação acima sempre vale
    // contra o valor certo, nunca contra um "último push" obsoleto.
    setLastPushedSearch(filterState.search);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = filterStateRef.current;
      if (searchInput !== (current.search ?? "")) {
        const nextSearch = searchInput || undefined;
        // Otimista: marca ANTES de navegar, pra quando o commit chegar (via
        // re-render) já sabermos que foi um eco nosso, não uma mudança
        // externa — sem isso, digitar mais enquanto a navegação está em voo
        // faria o commit tardio sobrescrever o que o usuário já digitou por
        // cima (ver comentário acima).
        setLastPushedSearch(nextSearch);
        setFilterState({ ...current, search: nextSearch });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, setFilterState]);

  function updateFilter(key: keyof OrganizationFilterState, value: string | undefined) {
    // Nunca espalha o `filterState` do componente (pode ser uma closure
    // obsoleta de um render anterior) — `updateFilterKey` navega direto a
    // partir da URL viva, então cliques rápidos em dropdowns diferentes não
    // se revertem um ao outro. Ver comentário em updateFilterKey no hook.
    updateFilterKey(key, value);
  }

  // Aplicar um filtro salvo é um replace TOTAL do filter_state — diferente
  // de updateFilter (uma tecla por vez) — então usar setFilterState aqui
  // está correto. Mas precisa também forçar searchInput/lastPushedSearch/
  // syncedUrlSearch pro valor aplicado, incondicionalmente: se o usuário já
  // tinha editado o campo localmente (ex.: `fill("")`) sem o debounce ainda
  // ter disparado, e o filtro salvo tem o MESMO `search` que já estava na
  // URL, o bloco de reconciliação no render (abaixo) nunca dispara (o valor
  // de filterState.search não muda) e o campo ficaria preso no valor local
  // não commitado. Ver bug reproduzido em e2e/contacts.spec.ts (mesmo padrão
  // copiado aqui).
  function applySavedFilter(next: OrganizationFilterState) {
    setFilterState(next);
    const nextSearch = next.search ?? "";
    setSearchInput(nextSearch);
    setLastPushedSearch(next.search);
    setSyncedUrlSearch(next.search);
  }

  function handlePaginationChange(updater: Updater<PaginationState>) {
    const current: PaginationState = { pageIndex: page - 1, pageSize };
    const next = typeof updater === "function" ? updater(current) : updater;
    if (next.pageSize !== current.pageSize) {
      setPageSize(next.pageSize);
    } else if (next.pageIndex !== current.pageIndex) {
      setPage(next.pageIndex + 1);
    }
  }

  function handleSortingChange(updater: Updater<SortingState>) {
    const current: SortingState = [{ id: sort, desc: dir === "desc" }];
    const next = typeof updater === "function" ? updater(current) : updater;
    const nextSort = next[0];
    if (!nextSort) {
      setSorting(DEFAULT_SORT, "asc");
    } else {
      setSorting(nextSort.id, nextSort.desc ? "desc" : "asc");
    }
  }

  const columns = useMemo<ColumnDef<DataGridFeatures, Organization>[]>(
    () => [
      {
        // Sem `id` explícito: o default do TanStack (= accessorKey) faz o id
        // da coluna bater com o nome da coluna no banco ("name"), que é o
        // mesmo valor trafegado em `sort`/`dir` pela URL (ver comentário
        // equivalente em contacts-table.tsx).
        accessorKey: "name",
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
        // Idem — sem `id` explícito, o id da coluna vira "org_type", batendo
        // com a coluna real do banco (antes era "type", só a coluna de
        // ordenação client-side do shim mapeava de volta — essa indireção
        // não existe mais).
        accessorKey: "org_type",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colType")} />
        ),
        enableSorting: true,
        cell: ({ row }) => t(`type${toPascalCase(row.original.org_type)}`),
      },
      {
        accessorKey: "tier",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colTier")} />
        ),
        enableSorting: true,
        cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>,
      },
      {
        accessorKey: "status",
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

      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="max-w-sm"
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="org-type-filter">{t("filterTypeLabel")}</Label>
          <Select
            value={filterState.orgType ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("orgType", value && value !== ALL_FILTER_VALUE ? value : undefined)
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
            value={filterState.tier ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("tier", value && value !== ALL_FILTER_VALUE ? value : undefined)
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
            value={filterState.status ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("status", value && value !== ALL_FILTER_VALUE ? value : undefined)
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
            value={filterState.sector ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("sector", value && value !== ALL_FILTER_VALUE ? value : undefined)
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
        currentFilterState={filterState}
        onApply={applySavedFilter}
      />

      <EntityDataGrid
        columns={columns}
        data={organizations}
        getRowId={(organization) => organization.id}
        totalCount={totalCount}
        pagination={{ pageIndex: page - 1, pageSize }}
        onPaginationChange={handlePaginationChange}
        sorting={[{ id: sort, desc: dir === "desc" }]}
        onSortingChange={handleSortingChange}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <OrganizationForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
