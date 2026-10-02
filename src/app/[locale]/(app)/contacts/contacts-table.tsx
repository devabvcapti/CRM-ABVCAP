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
import { deleteContact } from "./actions";
import { ContactForm } from "./contact-form";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

export function ContactsTable({
  contacts,
  tagsByContact,
}: {
  contacts: Contact[];
  tagsByContact: Record<string, string[]>;
}) {
  const t = useTranslations("ContactsPage");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);
  // Nonce incrementado a cada abertura — ver organizations-table.tsx: usar
  // editing?.id como key não bastava (toda criação tem editing=undefined,
  // então duas criações seguidas caem na mesma key e o Sheet para de fechar).
  const [formKey, setFormKey] = useState(0);

  function openCreate() {
    setEditing(undefined);
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteContact(id);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colTags")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colPhone")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{contact.full_name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(tagsByContact[contact.id] ?? []).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{contact.emails?.[0] ?? ""}</TableCell>
                <TableCell>{contact.phones?.[0] ?? ""}</TableCell>
                <TableCell className="flex justify-end gap-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit")}
                    onClick={() => openEdit(contact)}
                  >
                    <PencilIcon aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("delete")}
                    onClick={() => handleDelete(contact.id)}
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
        {/* key força remount a cada abertura — mesma razão documentada em
            organizations-table.tsx (useActionState preso em success=true;
            nonce, não identidade, porque duas operações iguais seguidas
            tinham a mesma key e o bug persistia). */}
        <ContactForm
          key={formKey}
          contact={editing}
          contactTags={editing ? tagsByContact[editing.id] : undefined}
          onSaved={() => setSheetOpen(false)}
        />
      </Sheet>
    </div>
  );
}
