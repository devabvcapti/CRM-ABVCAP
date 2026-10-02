"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Database } from "@/types/database";
import { createContact, updateContact, type ContactFormState } from "./actions";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

const initialState: ContactFormState = { error: null };

export function ContactForm({
  contact,
  contactTags,
  onSaved,
}: {
  contact?: Contact;
  contactTags?: string[];
  onSaved: () => void;
}) {
  const t = useTranslations("ContactsPage");
  const action = contact ? updateContact.bind(null, contact.id) : createContact;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_name"
      ? t("errorRequiredName")
      : state.error === "generic"
        ? t("errorGeneric")
        : undefined;

  return (
    <SheetContent>
      <form action={formAction} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>{contact ? t("formTitleEdit") : t("formTitleCreate")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="full_name">{t("fieldFullName")}</FieldLabel>
              <Input id="full_name" name="full_name" defaultValue={contact?.full_name} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="tags">{t("fieldTags")}</FieldLabel>
              <Input id="tags" name="tags" defaultValue={contactTags?.join(", ")} />
              <FieldDescription>{t("fieldTagsHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="emails">{t("fieldEmails")}</FieldLabel>
              <Input id="emails" name="emails" defaultValue={contact?.emails?.join(", ")} />
              <FieldDescription>{t("fieldListHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="phones">{t("fieldPhones")}</FieldLabel>
              <Input id="phones" name="phones" defaultValue={contact?.phones?.join(", ")} />
              <FieldDescription>{t("fieldListHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="languages">{t("fieldLanguages")}</FieldLabel>
              <Input
                id="languages"
                name="languages"
                defaultValue={contact?.languages?.join(", ")}
              />
              <FieldDescription>{t("fieldListHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="linkedin_url">{t("fieldLinkedin")}</FieldLabel>
              <Input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                defaultValue={contact?.linkedin_url ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">{t("fieldNotes")}</FieldLabel>
              <Textarea id="notes" name="notes" defaultValue={contact?.notes ?? ""} rows={4} />
            </Field>
            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </FieldGroup>
        </div>
        <SheetFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("submitting") : contact ? t("submitEdit") : t("submitCreate")}
          </Button>
          <SheetClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </SheetClose>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
