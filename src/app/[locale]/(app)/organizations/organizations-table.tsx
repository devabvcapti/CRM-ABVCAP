"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { EntityDataGrid } from "@/components/shared/entity-data-grid";
import { Link, useRouter } from "@/i18n/navigation";
import type { Database } from "@/types/database";
import type { OrganizationFormState } from "./actions";
import { OrganizationForm } from "./organization-form";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function OrganizationsTable({ organizations }: { organizations: Organization[] }) {
  const t = useTranslations("OrganizationsPage");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Nonce incrementado a cada abertura — ver ai-context/skills/08-testing-quality.md:
  // key por identidade não basta (duas criações seguidas cairiam na mesma key).
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState("");

  // Filtro client-side sobre a lista já carregada — não é busca full-text no
  // banco (isso fica para quando houver volume real de organizações que
  // justifique).
  // Memoizado: EntityDataGrid reseta a paginação para a página 1 sempre que a
  // referência de `data` muda, e sem useMemo um re-render do pai (ex.: abrir
  // o Sheet de "Nova organização") recriava o array a cada vez, jogando o
  // usuário de volta à página 1 mesmo sem a busca ter mudado.
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter((organization) =>
        organization.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [organizations, search],
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
          <EntityDataGrid
            columns={columns}
            data={filteredOrganizations}
            getRowId={(organization) => organization.id}
          />
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <OrganizationForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
