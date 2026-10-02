"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database";
import { deleteOrganization } from "./actions";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(organization: Organization) {
    setEditing(organization);
    setSheetOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteOrganization(id);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colTier")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell className="font-medium">{organization.name}</TableCell>
                <TableCell>{t(`type${toPascalCase(organization.org_type)}`)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{organization.tier}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={organization.status === "ativo" ? "default" : "secondary"}>
                    {t(`status${toPascalCase(organization.status)}`)}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit")}
                    onClick={() => openEdit(organization)}
                  >
                    <PencilIcon aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("delete")}
                    onClick={() => handleDelete(organization.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* key força remount a cada abertura — sem isso, o useActionState do
            form reaproveita a instância anterior e, como `state.success` já
            era `true` desde a última submissão, o useEffect que fecha o
            Sheet nunca via o valor "mudar" de novo (true -> true). Achado
            via teste E2E real (a edição nunca fechava o Sheet). */}
        <OrganizationForm
          key={editing?.id ?? "create"}
          organization={editing}
          onSaved={() => setSheetOpen(false)}
        />
      </Sheet>
    </div>
  );
}
