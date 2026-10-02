"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useRouter } from "@/i18n/navigation";
import type { Database } from "@/types/database";
import { OrganizationForm } from "../organization-form";
import { deleteOrganization } from "../actions";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

export function OrganizationEditDelete({ organization }: { organization: Organization }) {
  const t = useTranslations("OrganizationsPage");
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function openEdit() {
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function handleSaved() {
    setSheetOpen(false);
  }

  async function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const { error } = await deleteOrganization(organization.id);
    if (error) {
      window.alert(t("deleteError"));
      return;
    }
    router.push("/organizations");
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={openEdit}>
        <PencilIcon aria-hidden="true" />
        {t("edit")}
      </Button>
      <Button variant="outline" size="sm" onClick={handleDelete}>
        <Trash2Icon aria-hidden="true" />
        {t("delete")}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <OrganizationForm key={formKey} organization={organization} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
