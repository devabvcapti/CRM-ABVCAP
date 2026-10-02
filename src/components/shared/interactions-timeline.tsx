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
import { createInteraction, type InteractionFormState } from "@/lib/actions/interactions";

export type InteractionRow = {
  id: string;
  type: string;
  occurred_at: string;
  summary: string;
  classification_level: string;
};

type ParticipantType = "contact" | "organization";

const TYPES = ["reuniao", "email", "chamada", "evento_associativo"] as const;
const LEVELS = ["public", "internal", "confidential", "restricted"] as const;

function toPascalCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const initialState: InteractionFormState = { error: null };

// Compartilhado entre a página de detalhe de Contato e de Organização —
// interaction_participants é polimórfico (ver src/lib/actions/interactions.ts),
// e a UI (tipo/data/resumo/classificação) é idêntica para os dois, só muda o
// participante vinculado.
function AddInteractionForm({
  participantType,
  participantId,
  onAdded,
}: {
  participantType: ParticipantType;
  participantId: string;
  onAdded: () => void;
}) {
  const t = useTranslations("InteractionsTimeline");
  const [state, formAction, isPending] = useActionState(
    createInteraction.bind(null, participantType, participantId),
    initialState,
  );

  useEffect(() => {
    if (state.success) onAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_type"
      ? t("errorRequiredType")
      : state.error === "required_date"
        ? t("errorRequiredDate")
        : state.error === "required_summary"
          ? t("errorRequiredSummary")
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
          <FieldLabel htmlFor="type">{t("fieldType")}</FieldLabel>
          <Select name="type" required>
            <SelectTrigger id="type" className="w-full">
              {/* Select.Value da Base UI mostra o valor bruto, não o rótulo
                  do SelectItem — precisa de children função mesmo sem
                  defaultValue (reproduzido interativamente, não só com valor
                  pré-selecionado do banco; ver ai-context/skills/02-data-modeling.md). */}
              <SelectValue>
                {(value: string | null) => (value ? t(`type${toPascalCase(value)}`) : t("selectPlaceholder"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`type${toPascalCase(type)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="occurred_at">{t("fieldOccurredAt")}</FieldLabel>
          <Input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            defaultValue={nowLocal}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="summary">{t("fieldSummary")}</FieldLabel>
          <Textarea id="summary" name="summary" rows={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="classification_level">{t("fieldClassification")}</FieldLabel>
          <Select name="classification_level" defaultValue="internal" required>
            <SelectTrigger id="classification_level" className="w-full">
              {/* Select.Value da Base UI mostra o valor bruto, não o rótulo
                  do SelectItem — precisa de children função pra traduzir
                  quando pré-selecionado via defaultValue. */}
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
          {isPending ? t("submitting") : t("add")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function InteractionsTimeline({
  participantType,
  participantId,
  interactions,
}: {
  participantType: ParticipantType;
  participantId: string;
  interactions: InteractionRow[];
}) {
  const t = useTranslations("InteractionsTimeline");
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{t("title")}</h3>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interactions.map((interaction) => (
            <li key={interaction.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{t(`type${toPascalCase(interaction.type)}`)}</Badge>
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
        participantType={participantType}
        participantId={participantId}
        onAdded={() => setFormKey((key) => key + 1)}
      />
    </div>
  );
}
