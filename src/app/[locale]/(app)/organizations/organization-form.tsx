"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Database } from "@/types/database";
import { createOrganization, updateOrganization, type OrganizationFormState } from "./actions";
import { ORG_TYPES, TIERS, STATUSES } from "./constants";

type Organization = Database["crm_abvcap"]["Tables"]["organizations"]["Row"];

const initialState: OrganizationFormState = { error: null };

export function OrganizationForm({
  organization,
  onSaved,
}: {
  organization?: Organization;
  onSaved: (state: OrganizationFormState) => void;
}) {
  const t = useTranslations("OrganizationsPage");
  const action = organization
    ? updateOrganization.bind(null, organization.id)
    : createOrganization;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSaved(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_name"
      ? t("errorRequiredName")
      : state.error === "required_type"
        ? t("errorRequiredType")
        : state.error === "required_tier"
          ? t("errorRequiredTier")
          : state.error === "generic"
            ? t("errorGeneric")
            : undefined;

  return (
    <SheetContent>
      <form action={formAction} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>{organization ? t("formTitleEdit") : t("formTitleCreate")}</SheetTitle>
          <SheetDescription>{t("formDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("fieldName")}</FieldLabel>
              <Input id="name" name="name" defaultValue={organization?.name} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="legal_name">{t("fieldLegalName")}</FieldLabel>
              <Input
                id="legal_name"
                name="legal_name"
                defaultValue={organization?.legal_name ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="org_type">{t("fieldType")}</FieldLabel>
              <Select name="org_type" defaultValue={organization?.org_type} required>
                <SelectTrigger id="org_type" className="w-full">
                  {/* Select.Value da Base UI mostra o valor bruto armazenado,
                      não o rótulo do SelectItem — precisa de children função
                      pra traduzir quando pré-selecionado via defaultValue. */}
                  <SelectValue>
                    {(value: string | null) =>
                      value ? t(`type${toPascalCase(value)}`) : t("selectPlaceholder")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`type${toPascalCase(type)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="tier">{t("fieldTier")}</FieldLabel>
              <Select name="tier" defaultValue={organization?.tier} required>
                <SelectTrigger id="tier" className="w-full">
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="priority_sectors">{t("fieldSectors")}</FieldLabel>
              <Input
                id="priority_sectors"
                name="priority_sectors"
                defaultValue={organization?.priority_sectors?.join(", ")}
              />
              <FieldDescription>{t("fieldSectorsHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="status">{t("fieldStatus")}</FieldLabel>
              <Select name="status" defaultValue={organization?.status ?? "ativo"} required>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      value ? t(`status${toPascalCase(value)}`) : t("selectPlaceholder")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`status${toPascalCase(status)}`)}
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
            {isPending ? t("submitting") : organization ? t("submitEdit") : t("submitCreate")}
          </Button>
          <SheetClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </SheetClose>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
