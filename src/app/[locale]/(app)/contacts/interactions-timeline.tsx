"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInteraction, type InteractionFormState } from "./actions";

export type InteractionRow = {
  id: string;
  type: string;
  occurred_at: string;
  summary: string;
  classification_level: string;
};

const TYPES = ["reuniao", "email", "chamada", "evento_associativo"] as const;
const LEVELS = ["public", "internal", "confidential", "restricted"] as const;

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const initialState: InteractionFormState = { error: null };

function AddInteractionForm({
  contactId,
  onAdded,
}: {
  contactId: string;
  onAdded: () => void;
}) {
  const t = useTranslations("ContactsPage");
  const [state, formAction, isPending] = useActionState(
    createInteraction.bind(null, contactId),
    initialState,
  );

  useEffect(() => {
    if (state.success) onAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_type"
      ? t("interactionErrorRequiredType")
      : state.error === "required_date"
        ? t("interactionErrorRequiredDate")
        : state.error === "required_summary"
          ? t("interactionErrorRequiredSummary")
          : state.error === "generic"
            ? t("errorGeneric")
            : undefined;

  // Date.now() é impuro — não pode rodar direto no corpo do componente
  // (regra de pureza do React). Calculado uma vez, lazy, no mount.
  const [nowLocal] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border p-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="type">{t("interactionFieldType")}</FieldLabel>
          <Select name="type" required>
            <SelectTrigger id="type" className="w-full">
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`interactionType${toPascalCase(type)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="occurred_at">{t("interactionFieldOccurredAt")}</FieldLabel>
          <Input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            defaultValue={nowLocal}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="summary">{t("interactionFieldSummary")}</FieldLabel>
          <Textarea id="summary" name="summary" rows={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="classification_level">
            {t("interactionFieldClassification")}
          </FieldLabel>
          <Select name="classification_level" defaultValue="internal" required>
            <SelectTrigger id="classification_level" className="w-full">
              {/* Select.Value da Base UI mostra o valor bruto, não o rótulo
                  do SelectItem — precisa de children função pra traduzir
                  quando pré-selecionado via defaultValue (ver
                  organization-form.tsx para a mesma correção). */}
              <SelectValue>
                {(value: string | null) => (value ? t(`classification${toPascalCase(value)}`) : "")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {t(`classification${toPascalCase(level)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? t("submitting") : t("interactionAdd")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function InteractionsTimeline({
  contactId,
  interactions,
}: {
  contactId: string;
  interactions: InteractionRow[];
}) {
  const t = useTranslations("ContactsPage");
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{t("interactionsTitle")}</h3>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("interactionsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interactions.map((interaction) => (
            <li key={interaction.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">
                  {t(`interactionType${toPascalCase(interaction.type)}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(interaction.occurred_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{interaction.summary}</p>
              {interaction.classification_level !== "internal" && (
                <Badge variant="secondary" className="mt-2">
                  {t(`classification${toPascalCase(interaction.classification_level)}`)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddInteractionForm
        key={formKey}
        contactId={contactId}
        onAdded={() => setFormKey((key) => key + 1)}
      />
    </div>
  );
}
