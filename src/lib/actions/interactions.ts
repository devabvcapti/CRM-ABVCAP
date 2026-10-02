"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const INTERACTION_TYPES = ["reuniao", "email", "chamada", "evento_associativo"] as const;
const CLASSIFICATION_LEVELS = ["public", "internal", "confidential", "restricted"] as const;

const interactionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  occurred_at: z.string().min(1),
  summary: z.string().min(1),
  classification_level: z.enum(CLASSIFICATION_LEVELS),
});

export type InteractionFormState = {
  error: "required_type" | "required_date" | "required_summary" | "generic" | null;
  success?: boolean;
};

type ParticipantType = "contact" | "organization";

// revalidatePath com o literal "/[locale]/<resource>/[id]" (padrão de rota
// dinâmica) invalida TODAS as páginas de detalhe já renderizadas, não só uma
// id específica — sem granularidade por id (mesmo caso de revalidateContacts
// em contacts/actions.ts).
function revalidateParticipant(participantType: ParticipantType) {
  const resource = participantType === "contact" ? "contacts" : "organizations";
  revalidatePath(`/[locale]/${resource}`, "page");
  revalidatePath(`/[locale]/${resource}/[id]`, "page");
}

// Compartilhado entre Contatos e Organizações — ambos podem ser
// participant_type de interactions (interaction_participants é polimórfico,
// ver 0003_crm_fase1_core.sql). Registra a interação e já vincula o
// participante.
export async function createInteraction(
  participantType: ParticipantType,
  participantId: string,
  _prevState: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const parsed = interactionSchema.safeParse({
    type: formData.get("type"),
    occurred_at: formData.get("occurred_at"),
    summary: formData.get("summary"),
    classification_level: formData.get("classification_level") || "internal",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.type) return { error: "required_type" };
    if (fieldErrors.occurred_at) return { error: "required_date" };
    if (fieldErrors.summary) return { error: "required_summary" };
    return { error: "generic" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .insert({
      type: parsed.data.type,
      occurred_at: parsed.data.occurred_at,
      summary: parsed.data.summary,
      classification_level: parsed.data.classification_level,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "generic" };

  const { error: participantError } = await supabase.from("interaction_participants").insert({
    interaction_id: data.id,
    participant_type: participantType,
    participant_id: participantId,
  });

  if (participantError) return { error: "generic" };

  revalidateParticipant(participantType);
  return { error: null, success: true };
}
