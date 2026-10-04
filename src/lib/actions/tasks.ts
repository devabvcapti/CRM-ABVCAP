"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const taskSchema = z.object({
  description: z.string().trim().min(1),
  due_date: z.string().min(1),
  assigned_to: z.string().min(1),
});

export type TaskFormState = {
  error: "required_description" | "required_due_date" | "required_assigned_to" | "generic" | null;
  success?: boolean;
};

type ParticipantType = "contact" | "organization";

// revalidatePath com o literal "/[locale]/<resource>/[id]" (padrão de rota
// dinâmica) invalida TODAS as páginas de detalhe já renderizadas, não só uma
// id específica — sem granularidade por id (mesmo caso de
// revalidateParticipant em interactions.ts).
function revalidateParticipant(participantType: ParticipantType) {
  const resource = participantType === "contact" ? "contacts" : "organizations";
  revalidatePath(`/[locale]/${resource}`, "page");
  revalidatePath(`/[locale]/${resource}/[id]`, "page");
}

// Compartilhado entre Contatos e Organizações — ambos podem ser
// participant_type de tasks (polimórfico, sem tabela de participantes
// separada — uma tarefa é de um participante só, ver
// 0008_crm_tasks.sql).
export async function createTask(
  participantType: ParticipantType,
  participantId: string,
  _prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const parsed = taskSchema.safeParse({
    description: formData.get("description"),
    due_date: formData.get("due_date"),
    assigned_to: formData.get("assigned_to"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.description) return { error: "required_description" };
    if (fieldErrors.due_date) return { error: "required_due_date" };
    if (fieldErrors.assigned_to) return { error: "required_assigned_to" };
    return { error: "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    participant_type: participantType,
    participant_id: participantId,
    description: parsed.data.description,
    due_date: parsed.data.due_date,
    assigned_to: parsed.data.assigned_to,
  });

  if (error) return { error: "generic" };

  revalidateParticipant(participantType);
  return { error: null, success: true };
}

// Grava done_at no valor-alvo que o CHAMADOR decidiu (não inverte um
// estado lido do banco) — idempotente: duas chamadas com o mesmo `done`
// convergem pro mesmo resultado, nunca se cancelam. Um toggle que lê
// done_at e inverte (desenho original) faz o OPOSTO do que a Review Focus
// pedia: se a aba de outro usuário já concluiu a tarefa, esta aba (ainda
// mostrando pendente) ao "concluir" leria done=true e inverteria de volta
// pra pendente, reabrindo silenciosamente o que o outro acabou de
// concluir. Com o alvo explícito, cada clique declara sua intenção real e
// a última escrita vence (last-write-wins padrão), sem cancelamento.
//
// `.update(...).select(...).single()` retorna erro (PGRST116, "0 rows")
// quando RLS filtra a linha do UPDATE (ex.: papel sem permissão) — o
// mesmo caminho de erro "tarefa não encontrada" cobre as duas causas sem
// round-trip extra, e elimina o SELECT prévio que a versão anterior
// precisava (ineficiência já apontada na review do Task 1).
export async function setTaskDone(taskId: string, done: boolean): Promise<{ error: boolean }> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId)
    .select("participant_type")
    .single();

  if (error || !task) return { error: true };

  revalidateParticipant(task.participant_type as ParticipantType);
  return { error: false };
}

// Mesma técnica de setTaskDone: delete-com-select-single detecta um
// DELETE bloqueado por RLS (ex.: papel analista, que pode concluir
// tarefas mas não está em tasks_delete_manager — só admin+gestor) como
// erro, em vez de PostgREST silenciosamente excluir 0 linhas e devolver
// sucesso vazio. Sem isso, o usuário clica na lixeira, confirma o
// window.confirm, e nada acontece — sem alerta, sem feedback, tarefa
// ainda lá. Também elimina o SELECT prévio da versão anterior (mesmo
// ganho de eficiência de setTaskDone).
export async function deleteTask(taskId: string): Promise<{ error: boolean }> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("participant_type")
    .single();

  if (error || !task) return { error: true };

  revalidateParticipant(task.participant_type as ParticipantType);
  return { error: false };
}
