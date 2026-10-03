"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createContact, type ContactCreateFormState } from "./actions";

const initialState: ContactCreateFormState = { error: null };

export function ContactCreateForm({
  organizations,
  onSaved,
}: {
  organizations: { id: string; name: string }[];
  onSaved: (state: ContactCreateFormState) => void;
}) {
  const t = useTranslations("ContactsPage");
  const [state, formAction, isPending] = useActionState(createContact, initialState);

  useEffect(() => {
    if (state.success) onSaved(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_name"
      ? t("errorRequiredName")
      : state.error === "required_title"
        ? t("errorRequiredTitle")
        : state.error === "required_email"
          ? t("errorRequiredEmail")
          : state.error === "required_phone"
            ? t("errorRequiredPhone")
            : state.error === "required_org"
              ? t("linkErrorRequiredOrg")
              : state.error === "generic"
                ? t("errorGeneric")
                : undefined;

  return (
    <SheetContent>
      <form action={formAction} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>{t("formTitleCreate")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FieldGroup>
            {/* Sem `required` nativo em nenhum campo: os 5 estados de erro
                de ContactCreateFormState (required_name/title/email/phone/org)
                só são alcançáveis se o submit chegar até a Server Action —
                um `required` do HTML bloquearia o submit no browser antes
                disso, escondendo a FieldError traduzida atrás de um tooltip
                nativo não traduzido (ver Review Focus: campo obrigatório
                vazio precisa de erro visível == o texto de `errorMessage`
                abaixo). */}
            <Field>
              <FieldLabel htmlFor="full_name">{t("fieldFullName")}</FieldLabel>
              <Input id="full_name" name="full_name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="title">{t("fieldTitle")}</FieldLabel>
              <Input id="title" name="title" />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">{t("fieldEmail")}</FieldLabel>
              {/* type="text" (não "email"): o browser validaria o formato
                  sozinho, sem tradução, antes do submit chegar na Server
                  Action — mesmo raciocínio do comentário acima sobre não usar
                  `required` nativo nos campos. `inputMode="email"` mantém o
                  teclado numérico/@ no mobile sem acionar essa validação. */}
              <Input id="email" name="email" type="text" inputMode="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">{t("fieldPhone")}</FieldLabel>
              <Input id="phone" name="phone" />
            </Field>
            <Field>
              <FieldLabel htmlFor="org_id">{t("fieldCompany")}</FieldLabel>
              <Select name="org_id">
                <SelectTrigger id="org_id" className="w-full">
                  {/* Select.Value da Base UI mostra o valor bruto (o uuid), não o
                      rótulo do SelectItem — precisa de children função (mesmo
                      padrão de organization-links.tsx). */}
                  <SelectValue>
                    {(value: string | null) =>
                      value
                        ? (organizations.find((organization) => organization.id === value)?.name ??
                          value)
                        : t("selectPlaceholder")
                    }
                  </SelectValue>
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
            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </FieldGroup>
        </div>
        <SheetFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("submitting") : t("submitCreate")}
          </Button>
          <SheetClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </SheetClose>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
