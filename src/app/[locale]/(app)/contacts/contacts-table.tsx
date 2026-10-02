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
import { ContactForm } from "./contact-form";
import type { ContactFormState } from "./actions";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colTags")}</TableHead>
                <TableHead>{t("colEmail")}</TableHead>
                <TableHead>{t("colPhone")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/contacts/${contact.id}`} className="block">
                      {contact.full_name}
                    </Link>
                  </TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <ContactForm key={formKey} onSaved={handleSaved} />
      </Sheet>
    </div>
  );
}
