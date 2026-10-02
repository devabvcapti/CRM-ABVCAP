"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { EntityDataGrid } from "@/components/shared/entity-data-grid";
import { Link, useRouter } from "@/i18n/navigation";
import type { Database } from "@/types/database";
import { ContactForm } from "./contact-form";
import type { ContactFormState } from "./actions";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

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
}: {
  contacts: Contact[];
  tagsByContact: Record<string, string[]>;
}) {
  const t = useTranslations("ContactsPage");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Nonce incrementado a cada abertura — ver ai-context/skills/08-testing-quality.md:
  // key por identidade não basta (duas criações seguidas cairiam na mesma key).
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState("");

  // Filtro client-side sobre a lista já carregada — não é busca full-text no
  // banco (isso fica para quando houver volume real de contatos que justifique).
  const filteredContacts = contacts.filter((contact) =>
    contact.full_name.toLowerCase().includes(search.trim().toLowerCase()),
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
