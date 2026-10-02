"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const filteredOrganizations = organizations.filter((organization) =>
    organization.name.toLowerCase().includes(search.trim().toLowerCase()),
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead>{t("colTier")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.map((organization) => (
                <TableRow key={organization.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/organizations/${organization.id}`} className="block">
                      {organization.name}
                    </Link>
                  </TableCell>
                  <TableCell>{t(`type${toPascalCase(organization.org_type)}`)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{organization.tier}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={organization.status === "ativo" ? "default" : "secondary"}>
                      {t(`status${toPascalCase(organization.status)}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <OrganizationForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
