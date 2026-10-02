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
import {
  addOrganizationLink,
  endOrganizationLink,
  type OrganizationLinkState,
} from "./actions";

export type OrganizationLinkRow = {
  id: string;
  org_id: string;
  org_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
};

const initialState: OrganizationLinkState = { error: null };

// Form isolado num componente próprio, remontado via `key` do pai a cada
// submissão bem-sucedida — mesmo bug documentado em skill 08 (useActionState
// preso em success=true entre duas submissões seguidas) se reproduziria aqui
// também, e um `form.reset()` sozinho não limpa o Select da Base UI (não
// escuta o evento nativo "reset", mantém o valor interno selecionado).
function AddLinkForm({
  contactId,
  organizations,
  onAdded,
}: {
  contactId: string;
  organizations: { id: string; name: string }[];
  onAdded: () => void;
}) {
  const t = useTranslations("ContactsPage");
  const [state, formAction, isPending] = useActionState(
    addOrganizationLink.bind(null, contactId),
    initialState,
  );

  useEffect(() => {
    if (state.success) onAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_org"
      ? t("linkErrorRequiredOrg")
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
          <FieldLabel htmlFor="org_id">{t("linkFieldOrg")}</FieldLabel>
          <Select name="org_id" required>
            <SelectTrigger id="org_id" className="w-full">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
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

export function OrganizationLinks({
  contactId,
  links,
  organizations,
}: {
  contactId: string;
  links: OrganizationLinkRow[];
  organizations: { id: string; name: string }[];
}) {
  const t = useTranslations("ContactsPage");
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
                <span className="font-medium">{link.org_name}</span>
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
                  onClick={() =>
                    startEndTransition(() => endOrganizationLink(link.id, contactId))
                  }
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
        contactId={contactId}
        organizations={organizations}
        onAdded={() => setAddFormKey((key) => key + 1)}
      />
    </div>
  );
}
