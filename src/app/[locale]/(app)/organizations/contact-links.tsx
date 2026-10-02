"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addContactLink, endContactLink, type ContactLinkState } from "./actions";

export type ContactLinkRow = {
  id: string;
  contact_id: string;
  contact_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
};

const initialState: ContactLinkState = { error: null };

// Mesma relação organization_contacts de contacts/organization-links.tsx, só
// que visto do lado da organização (vincula um contato, não uma organização)
// — por isso não compartilha o componente, os campos do form são diferentes
// (aqui seleciona-se um contato).
function AddLinkForm({
  orgId,
  contacts,
  onAdded,
}: {
  orgId: string;
  contacts: { id: string; name: string }[];
  onAdded: () => void;
}) {
  const t = useTranslations("OrganizationsPage");
  const [state, formAction, isPending] = useActionState(
    addContactLink.bind(null, orgId),
    initialState,
  );

  useEffect(() => {
    if (state.success) onAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_contact"
      ? t("linkErrorRequiredContact")
      : state.error === "required_role"
        ? t("linkErrorRequiredRole")
        : state.error === "required_date"
          ? t("linkErrorRequiredDate")
          : state.error === "generic"
            ? t("errorGeneric")
            : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="contact_id">{t("linkFieldContact")}</FieldLabel>
          <Select name="contact_id" required>
            <SelectTrigger id="contact_id" className="w-full">
              {/* Select.Value da Base UI mostra o valor bruto (o uuid), não o
                  rótulo do SelectItem — precisa de children função (ver
                  ai-context/skills/02-data-modeling.md). */}
              <SelectValue>
                {(value: string | null) =>
                  value
                    ? (contacts.find((contact) => contact.id === value)?.name ?? value)
                    : t("selectPlaceholder")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="role">{t("linkFieldRole")}</FieldLabel>
          <Input id="role" name="role" />
        </Field>
        <Field>
          <FieldLabel htmlFor="start_date">{t("linkFieldStartDate")}</FieldLabel>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? t("submitting") : t("linkAdd")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function ContactLinks({
  orgId,
  links,
  contacts,
}: {
  orgId: string;
  links: ContactLinkRow[];
  contacts: { id: string; name: string }[];
}) {
  const t = useTranslations("OrganizationsPage");
  const [isEnding, startEndTransition] = useTransition();
  const [addFormKey, setAddFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{t("linksTitle")}</h3>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{link.contact_name}</span>
                <span className="text-muted-foreground">
                  {link.role} · {link.start_date} – {link.end_date ?? t("linkOngoing")}
                </span>
              </div>
              {!link.end_date && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isEnding}
                  onClick={() => startEndTransition(() => endContactLink(link.id))}
                >
                  {t("linkEnd")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddLinkForm
        key={addFormKey}
        orgId={orgId}
        contacts={contacts}
        onAdded={() => setAddFormKey((key) => key + 1)}
      />
    </div>
  );
}
