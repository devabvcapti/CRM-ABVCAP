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

// Alterna done_at (null -> now(), now() -> null) — nunca recebe o
// valor-alvo do chamador: lê o estado atual antes de inverter, pra um
// clique duplo/atrasado do cliente nunca sobrescrever uma conclusão (ou
// reabertura) feita por outra aba/usuário entre a leitura do cliente e o
// clique.
export async function toggleTaskDone(taskId: string): Promise<{ error: boolean }> {
  const supabase = await createClient();

  const { data: task, error: selectError } = await supabase
    .from("tasks")
    .select("done_at, participant_type")
    .eq("id", taskId)
    .single();

  if (selectError || !task) return { error: true };

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ done_at: task.done_at ? null : new Date().toISOString() })
    .eq("id", taskId);

  if (updateError) return { error: true };

  revalidateParticipant(task.participant_type as ParticipantType);
  return { error: false };
}

export async function deleteTask(taskId: string): Promise<{ error: boolean }> {
  const supabase = await createClient();

  const { data: task, error: selectError } = await supabase
    .from("tasks")
    .select("participant_type")
    .eq("id", taskId)
    .single();

  if (selectError || !task) return { error: true };

  const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);

  if (deleteError) return { error: true };

  revalidateParticipant(task.participant_type as ParticipantType);
  return { error: false };
}
