"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef, PaginationState, SortingState, Updater } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ContactCreateForm } from "./contact-create-form";
import type { ContactCreateFormState } from "./actions";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

// Shape exato do filter_state salvo em saved_filters para entity_type =
// "contact" — reflete 1:1 os campos de busca/filtro geridos pelo hook
// `useEntityListUrlState` abaixo. Campo chama orgId (guarda o id da
// organização, não o nome) — mesma convenção de orgType/tier/status/sector em
// OrganizationFilterState.
export type ContactFilterState = {
  search?: string;
  tag?: string;
  title?: string;
  orgId?: string;
};

// Referência estável (módulo, não recriado a cada render) — evita que o
// useMemo interno de useEntityListUrlState recalcule por uma nova identidade
// de array a cada render do componente.
const CONTACT_FILTER_KEYS: (keyof ContactFilterState & string)[] = [
  "search",
  "tag",
  "title",
  "orgId",
];

const DEFAULT_SORT = "full_name";
const SEARCH_DEBOUNCE_MS = 350;

// Sentinela só de UI pro item "Todos" do Select — nunca aparece em
// filter_state (lá, "sem filtro" é undefined, não essa string).
const ALL_FILTER_VALUE = "__all__";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ContactsTable({
  contacts,
  totalCount,
  tagOptions,
  titleOptions,
  companyOptions,
  organizations,
  savedFilters,
}: {
  contacts: Contact[];
  totalCount: number;
  tagOptions: string[];
  titleOptions: string[];
  companyOptions: { id: string; name: string }[];
  organizations: { id: string; name: string }[];
  savedFilters: { id: string; name: string; filter_state: ContactFilterState }[];
}) {
  const t = useTranslations("ContactsPage");
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
  } = useEntityListUrlState<ContactFilterState>(CONTACT_FILTER_KEYS, {
    sort: DEFAULT_SORT,
  });

  // Busca com debounce (350ms) antes de navegar — o campo em si continua
  // controlado localmente pro valor digitado aparecer sem atraso; só a
  // NAVEGAÇÃO (e portanto a ida ao servidor) é adiada. Ver docs/superpowers/
  // specs/2026-10-03-server-side-list-pagination-design.md.
  const [searchInput, setSearchInput] = useState(filterState.search ?? "");
  // "Latest ref" só pro callback do debounce (abaixo) ler o filterState mais
  // recente sem precisar reiniciar o timer a cada troca de tag/cargo/empresa
  // — mutação sempre dentro de efeito, nunca durante o render, e nunca LIDO
  // durante o render tampouco (ver react-hooks/refs — a regra proíbe os dois).
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
  // mudou" — different de mutar/ler um ref).
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

  function updateFilter(key: keyof ContactFilterState, value: string | undefined) {
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
  // não commitado. Ver bug reproduzido em e2e/contacts.spec.ts.
  function applySavedFilter(next: ContactFilterState) {
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

  const columns = useMemo<ColumnDef<DataGridFeatures, Contact>[]>(
    () => [
      {
        // Sem `id` explícito: o default do TanStack (= accessorKey) faz o id
        // da coluna bater com o nome da coluna no banco ("full_name"), que é
        // o mesmo valor trafegado em `sort`/`dir` pela URL — sem isso,
        // `column.getIsSorted()`/`sorting={[{ id: sort, ... }]}` nunca
        // combinariam (coluna "name" vs. parâmetro "full_name"), e o clique
        // no cabeçalho nunca seria reconhecido como "já ordenado por aqui".
        accessorKey: "full_name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colName")} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {/* Decorativo: o nome do link já carrega o nome acessível da
                célula — sem isso, as iniciais vazavam para o nome computado
                e quebravam `getByRole("cell", { name, exact: true })` nos
                testes E2E (ver ai-context/skills/04-ui-design-system.md). */}
            <Avatar className="size-6" aria-hidden="true">
              <AvatarFallback>{initials(row.original.full_name)}</AvatarFallback>
            </Avatar>
            <Link href={`/contacts/${row.original.id}`} className="font-medium">
              {row.original.full_name}
            </Link>
          </div>
        ),
      },
      {
        id: "title",
        accessorKey: "title",
        header: t("colTitle"),
        enableSorting: false,
        cell: (info) => (info.getValue() as string | null) ?? "—",
      },
      {
        id: "email",
        accessorFn: (row) => row.emails?.[0] ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colEmail")} />
        ),
        // Ordenação por E-mail removida (decisão da spec): não há forma
        // limpa de ordenar por elemento de array via `.order()` do Supabase
        // sem coluna/view computada à parte, e o ganho não justifica esse
        // trabalho extra agora.
        enableSorting: false,
        cell: (info) => info.getValue() as string,
      },
      {
        id: "phone",
        accessorFn: (row) => row.phones?.[0] ?? "",
        header: t("colPhone"),
        enableSorting: false,
        cell: (info) => info.getValue() as string,
      },
    ],
    [t],
  );

  function openCreate() {
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function handleSaved(state: ContactCreateFormState) {
    setSheetOpen(false);
    // Criar sempre navega para o detalhe do novo contato — é lá que ficam
    // vínculos, timeline de interações, editar e excluir.
    if (state.id) router.push(`/contacts/${state.id}`);
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
          <Label htmlFor="contact-tag-filter">{t("filterTagLabel")}</Label>
          <Select
            value={filterState.tag ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("tag", value && value !== ALL_FILTER_VALUE ? value : undefined)
            }
          >
            <SelectTrigger id="contact-tag-filter" className="w-44">
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
              {tagOptions.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="contact-title-filter">{t("filterTitleLabel")}</Label>
          <Select
            value={filterState.title ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("title", value && value !== ALL_FILTER_VALUE ? value : undefined)
            }
          >
            <SelectTrigger id="contact-title-filter" className="w-44">
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
              {titleOptions.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="contact-company-filter">{t("filterCompanyLabel")}</Label>
          <Select
            value={filterState.orgId ?? ALL_FILTER_VALUE}
            onValueChange={(value) =>
              updateFilter("orgId", value && value !== ALL_FILTER_VALUE ? value : undefined)
            }
          >
            <SelectTrigger id="contact-company-filter" className="w-44">
              <SelectValue>
                {(value: string | null) =>
                  value && value !== ALL_FILTER_VALUE
                    ? companyOptions.find((org) => org.id === value)?.name ??
                      t("filterCompanyUnknown")
                    : tSavedFilters("filterAllOption")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>
                {tSavedFilters("filterAllOption")}
              </SelectItem>
              {companyOptions.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SavedFiltersControl
        entityType="contact"
        savedFilters={savedFilters}
        currentFilterState={filterState}
        onApply={applySavedFilter}
      />

      <EntityDataGrid
        columns={columns}
        data={contacts}
        getRowId={(contact) => contact.id}
        totalCount={totalCount}
        pagination={{ pageIndex: page - 1, pageSize }}
        onPaginationChange={handlePaginationChange}
        sorting={[{ id: sort, desc: dir === "desc" }]}
        onSortingChange={handleSortingChange}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <ContactCreateForm key={formKey} organizations={organizations} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
