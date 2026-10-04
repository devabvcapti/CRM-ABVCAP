"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createTask, setTaskStatus, deleteTask, type TaskFormState } from "@/lib/actions/tasks";

export type TaskRow = {
  id: string;
  description: string;
  due_date: string;
  assigned_to: string;
  assigned_to_name: string;
  done_at: string | null;
};

type ParticipantType = "contact" | "organization";

const initialState: TaskFormState = { error: null };

// Compartilhado entre a página de detalhe de Contato e de Organização —
// tasks é polimórfico (ver src/lib/actions/tasks.ts), e a UI (descrição/data/
// atribuída a) é idêntica para os dois, só muda o participante vinculado.
// Mesmo padrão de generalização de AddInteractionForm (interactions-timeline.tsx).
function AddTaskForm({
  participantType,
  participantId,
  assignableProfiles,
  currentProfileId,
  onAdded,
}: {
  participantType: ParticipantType;
  participantId: string;
  assignableProfiles: { id: string; name: string }[];
  currentProfileId: string;
  onAdded: () => void;
}) {
  const t = useTranslations("TasksList");
  const [state, formAction, isPending] = useActionState(
    createTask.bind(null, participantType, participantId),
    initialState,
  );

  useEffect(() => {
    if (state.success) onAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_description"
      ? t("errorRequiredDescription")
      : state.error === "required_due_date"
        ? t("errorRequiredDueDate")
        : state.error === "required_assigned_to"
          ? t("errorRequiredAssignedTo")
          : state.error === "generic"
            ? t("errorGeneric")
            : undefined;

  // Date.now() é impuro — não pode rodar direto no corpo do componente
  // (regra de pureza do React). Calculado uma vez, lazy, no mount. Mesmo
  // padrão de AddInteractionForm (interactions-timeline.tsx).
  const [nowLocal] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border p-3">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="description">{t("fieldDescription")}</FieldLabel>
          <Textarea id="description" name="description" rows={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="due_date">{t("fieldDueDate")}</FieldLabel>
          <Input id="due_date" name="due_date" type="datetime-local" defaultValue={nowLocal} />
        </Field>
        <Field>
          <FieldLabel htmlFor="assigned_to">{t("fieldAssignedTo")}</FieldLabel>
          <Select name="assigned_to" defaultValue={currentProfileId} required>
            <SelectTrigger id="assigned_to" className="w-full">
              {/* Select.Value da Base UI mostra o valor bruto (o uuid), não o
                  rótulo do SelectItem — precisa de children função, tanto
                  pro defaultValue pré-selecionado quanto pra escolha
                  interativa (ver ai-context/skills/02-data-modeling.md). */}
              <SelectValue>
                {(value: string | null) =>
                  value
                    ? (assignableProfiles.find((profile) => profile.id === value)?.name ?? value)
                    : t("selectPlaceholder")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {assignableProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
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

export function TasksList({
  participantType,
  participantId,
  tasks,
  assignableProfiles,
  currentProfileId,
}: {
  participantType: ParticipantType;
  participantId: string;
  tasks: TaskRow[];
  assignableProfiles: { id: string; name: string }[];
  currentProfileId: string;
}) {
  const t = useTranslations("TasksList");
  const [formKey, setFormKey] = useState(0);

  // Ordenado no próprio componente (não vem ordenado do servidor): pendentes
  // primeiro por due_date ascendente, concluídas depois por done_at
  // descendente (mais recente primeiro).
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDone = Boolean(a.done_at);
    const bDone = Boolean(b.done_at);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone) {
      return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
    }
    return (b.done_at ?? "") < (a.done_at ?? "") ? -1 : (b.done_at ?? "") > (a.done_at ?? "") ? 1 : 0;
  });

  // Ação simples sem campos de form — chamada direta, sem useActionState
  // (mesmo padrão de handleRemove em ContactTags). O cliente envia seu
  // próprio estado-alvo pretendido (não pede pro servidor inverter um
  // valor desconhecido) — é isso que torna edições concorrentes
  // consistentes: cada clique declara a intenção real, e a última
  // escrita vence, em vez de dois toggles poderem se cancelar.
  async function handleToggle(taskId: string, done: boolean) {
    const { error } = await setTaskStatus(taskId, done ? "concluida" : "a_fazer");
    if (error) window.alert(t("errorGeneric"));
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const { error } = await deleteTask(taskId);
    if (error) window.alert(t("errorGeneric"));
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{t("title")}</h3>

      {sortedTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedTasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={Boolean(task.done_at)}
                onCheckedChange={() => handleToggle(task.id, !task.done_at)}
                aria-label={task.description}
              />
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={
                      task.done_at ? "line-through text-muted-foreground" : "text-foreground"
                    }
                  >
                    {task.description}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("deleteLabel", { description: task.description })}
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(task.due_date).toLocaleString()} · {task.assigned_to_name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddTaskForm
        key={formKey}
        participantType={participantType}
        participantId={participantId}
        assignableProfiles={assignableProfiles}
        currentProfileId={currentProfileId}
        onAdded={() => setFormKey((key) => key + 1)}
      />
    </div>
  );
}
