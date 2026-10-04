"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanCommitMeta,
} from "@/components/reui/kanban";
import { setTaskStatus, deleteTask, type TaskStatus } from "@/lib/actions/tasks";

export type TaskCard = {
  id: string;
  description: string;
  due_date: string;
  assignedToId: string;
  assignedToName: string;
  participantType: "contact" | "organization";
  participantId: string;
  participantName: string;
  isOverdue: boolean;
  isDueSoon: boolean;
};

// Ordem fixa de renderização das 3 colunas (Record não garante ordem de
// iteração estável entre ambientes/engines da mesma forma que um array
// explícito garante).
const COLUMN_ORDER: TaskStatus[] = ["a_fazer", "em_andamento", "concluida"];

const COLUMN_LABEL_KEYS: Record<TaskStatus, string> = {
  a_fazer: "columnAFazer",
  em_andamento: "columnEmAndamento",
  concluida: "columnConcluida",
};

export function TasksKanban({
  columns: initialColumns,
  currentProfileId,
}: {
  columns: Record<TaskStatus, TaskCard[]>;
  currentProfileId: string;
}) {
  const t = useTranslations("TasksList");
  const [columns, setColumns] = useState<Record<TaskStatus, TaskCard[]>>(initialColumns);
  // Desligado por padrão (Global Constraint — "/tasks" mostra tudo por
  // padrão, o toggle é a única exceção).
  const [onlyMine, setOnlyMine] = useState(false);

  // `Kanban` é genérico sobre `Record<string, T[]>`; nosso estado é o tipo
  // mais específico `Record<TaskStatus, T[]>` (sempre as mesmas 3 chaves).
  // Um wrapper evita problemas de variância de função ao passar o setState
  // tipado diretamente como `onValueChange`.
  function handleValueChange(value: Record<string, TaskCard[]>) {
    setColumns(value as Record<TaskStatus, TaskCard[]>);
  }

  // `value`/`meta` aqui refletem o estado JÁ aplicado otimisticamente pelo
  // próprio Kanban (onValueChange rodou antes). `meta.overContainer` é a
  // coluna de DESTINO — é ela que vira o novo status, não `activeContainer`
  // (origem). Column drags (`meta.kind === "column"`) nunca acontecem nesta
  // tela (nenhuma KanbanColumnHandle renderizada), mas o tipo do callback
  // cobre os dois casos.
  async function handleCommit(
    _value: Record<string, TaskCard[]>,
    meta: KanbanCommitMeta<TaskCard>,
  ) {
    if (meta.kind !== "item") return;

    const taskId = String(meta.event.active.id);
    const newStatus = meta.overContainer as TaskStatus;

    const { error } = await setTaskStatus(taskId, newStatus);
    if (error) {
      setColumns(meta.previousValue as Record<TaskStatus, TaskCard[]>);
      window.alert(t("errorGeneric"));
    }
  }

  async function handleDelete(card: TaskCard) {
    if (!window.confirm(t("deleteConfirm"))) return;

    const { error } = await deleteTask(card.id);
    if (error) {
      window.alert(t("errorGeneric"));
      return;
    }

    // Não basta confiar só na revalidação de rota — o estado do Kanban é
    // local/controlado, então o card precisa sumir de `columns` aqui
    // também. Filtra em todas as colunas (não sabemos de qual sem procurar,
    // e procurar é mais simples/robusto que rastrear a coluna atual).
    setColumns((prev) => {
      const next = { ...prev };
      for (const status of COLUMN_ORDER) {
        next[status] = prev[status].filter((item) => item.id !== card.id);
      }
      return next;
    });
  }

  function findCard(id: UniqueIdentifier): TaskCard | undefined {
    for (const status of COLUMN_ORDER) {
      const found = columns[status].find((item) => item.id === id);
      if (found) return found;
    }
    return undefined;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch id="only-mine-toggle" checked={onlyMine} onCheckedChange={setOnlyMine} />
        <label htmlFor="only-mine-toggle" className="text-sm text-foreground">
          {t("onlyMineToggle")}
        </label>
      </div>

      <Kanban<TaskCard>
        value={columns}
        onValueChange={handleValueChange}
        getItemValue={(card) => card.id}
        onValueCommit={handleCommit}
      >
        <KanbanBoard>
          {COLUMN_ORDER.map((status) => {
            const columnLabel = t(COLUMN_LABEL_KEYS[status]);
            return (
              // Nenhuma KanbanColumnHandle renderizada aqui — colunas não
              // são arrastáveis entre si (Global Constraint).
              <KanbanColumn
                key={status}
                value={status}
                role="region"
                aria-label={columnLabel}
                className="flex min-h-40 flex-col gap-2 rounded-lg border bg-muted/30 p-3"
              >
                <h2 className="text-sm font-medium text-foreground">{columnLabel}</h2>
                <KanbanColumnContent value={status}>
                  {columns[status].map((card) => {
                    if (onlyMine && card.assignedToId !== currentProfileId) return null;

                    return (
                      <KanbanItem key={card.id} value={card.id}>
                        <KanbanItemHandle className="flex cursor-grab flex-col gap-2 rounded-md border bg-card p-3 text-sm shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={
                                card.participantType === "contact"
                                  ? `/contacts/${card.participantId}`
                                  : `/organizations/${card.participantId}`
                              }
                              className="font-medium text-foreground hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {card.participantName}
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("deleteLabel", { description: card.description })}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(card);
                              }}
                            >
                              <Trash2Icon aria-hidden="true" />
                            </Button>
                          </div>
                          <p className="text-foreground">{card.description}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(card.due_date).toLocaleString()}</span>
                            {/* `isOverdue`/`isDueSoon` são calculados uma vez no
                                servidor a partir só de `due_date` (sinal puro,
                                nunca mutado no cliente) — a coluna ATUAL
                                (`status`, a fonte de verdade de onde o card
                                está depois de um drag) decide se esse sinal
                                aparece. Sem o gate por coluna, arrastar uma
                                tarefa atrasada pra "Concluída" deixaria o selo
                                "Atrasada" visível ali até um reload (e
                                arrastar de volta pra fora de "Concluída"
                                precisaria desse MESMO sinal continuar
                                correto, não zerado permanentemente). */}
                            {status !== "concluida" && card.isOverdue ? (
                              <Badge variant="destructive">{t("urgencyOverdue")}</Badge>
                            ) : status !== "concluida" && card.isDueSoon ? (
                              <Badge variant="outline">{t("urgencyDueSoon")}</Badge>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {t("fieldAssignedTo")}: {card.assignedToName}
                          </span>
                        </KanbanItemHandle>
                      </KanbanItem>
                    );
                  })}
                </KanbanColumnContent>
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value }) => {
            const card = findCard(value);
            if (!card) return null;
            return (
              <div className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm shadow-lg">
                <p className="text-foreground">{card.description}</p>
              </div>
            );
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}
