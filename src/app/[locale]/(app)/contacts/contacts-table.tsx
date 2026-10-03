"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ContactForm } from "./contact-form";
import type { ContactFormState } from "./actions";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

// Shape exato do filter_state salvo em saved_filters para entity_type =
// "contact" — reflete 1:1 os 3 useState abaixo (busca + 2 dropdowns). Campo
// chama orgId (guarda o id da organização, não o nome) — mesma convenção de
// orgType/tier/status/sector em OrganizationFilterState.
export type ContactFilterState = {
  search?: string;
  tag?: string;
  orgId?: string;
};

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
  tagsByContact,
  organizationByContact,
  savedFilters,
}: {
  contacts: Contact[];
  tagsByContact: Record<string, string[]>;
  organizationByContact: Record<string, { id: string; name: string }>;
  savedFilters: { id: string; name: string; filter_state: ContactFilterState }[];
}) {
  const t = useTranslations("ContactsPage");
  const tSavedFilters = useTranslations("SavedFilters");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Nonce incrementado a cada abertura — ver ai-context/skills/08-testing-quality.md:
  // key por identidade não basta (duas criações seguidas cairiam na mesma key).
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);

  const tagOptions = useMemo(
    () => Array.from(new Set(Object.values(tagsByContact).flat())).sort(),
    [tagsByContact],
  );

  // Dedup por id — vários contatos podem compartilhar a mesma organização.
  const companyOptions = useMemo(
    () =>
      Array.from(
        new Map(Object.values(organizationByContact).map((org) => [org.id, org])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [organizationByContact],
  );

  const currentFilterState: ContactFilterState = {
    search,
    tag: tagFilter,
    orgId: companyFilter,
  };

  function applyFilterState(filterState: ContactFilterState) {
    setSearch(filterState.search ?? "");
    setTagFilter(filterState.tag ?? undefined);
    setCompanyFilter(filterState.orgId ?? undefined);
  }

  // Filtro client-side sobre a lista já carregada — não é busca full-text no
  // banco (isso fica para quando houver volume real de contatos que
  // justifique). Os 2 critérios de dropdown combinam com a busca por nome em
  // AND (cada `if` abaixo descarta a linha, nunca inclui) — Cargo compara por
  // `.includes()` (array — um contato pode ter várias tags), Empresa por
  // igualdade de id (organizationByContact[contact.id] é undefined pra um
  // contato sem vínculo institucional atual, daí o `?.` — nunca quebra, só
  // nunca combina com um companyFilter ativo).
  // Memoizado: EntityDataGrid reseta a paginação para a página 1 sempre que a
  // referência de `data` muda, e sem useMemo um re-render do pai (ex.: abrir
  // o Sheet de "Novo contato") recriava o array a cada vez, jogando o
  // usuário de volta à página 1 mesmo sem a busca ter mudado.
  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        if (!contact.full_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
        if (tagFilter && !(tagsByContact[contact.id] ?? []).includes(tagFilter)) return false;
        if (companyFilter && organizationByContact[contact.id]?.id !== companyFilter) return false;
        return true;
      }),
    [contacts, search, tagFilter, companyFilter],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, Contact>[]>(
    () => [
      {
        accessorKey: "full_name",
        id: "name",
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
        id: "tags",
        header: t("colTags"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(tagsByContact[row.original.id] ?? []).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "email",
        accessorFn: (row) => row.emails?.[0] ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("colEmail")} />
        ),
        enableSorting: true,
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
    [tagsByContact, t],
  );

  function openCreate() {
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function handleSaved(state: ContactFormState) {
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

      {contacts.length === 0 ? (
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
              <Label htmlFor="contact-tag-filter">{t("filterTagLabel")}</Label>
              <Select
                value={tagFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setTagFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
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
              <Label htmlFor="contact-company-filter">{t("filterCompanyLabel")}</Label>
              <Select
                value={companyFilter ?? ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setCompanyFilter(value && value !== ALL_FILTER_VALUE ? value : undefined)
                }
              >
                <SelectTrigger id="contact-company-filter" className="w-44">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value !== ALL_FILTER_VALUE
                        ? companyOptions.find((org) => org.id === value)?.name ?? value
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
            currentFilterState={currentFilterState}
            onApply={applyFilterState}
          />

          <EntityDataGrid
            columns={columns}
            data={filteredContacts}
            getRowId={(contact) => contact.id}
          />
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <ContactForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
