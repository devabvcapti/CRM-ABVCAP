import "server-only";
import type { createClient } from "./server";

// entity_tags.entity_id e interaction_participants.participant_id são
// polimórficos de propósito (apontam para contacts OU organizations) — por
// isso não têm FK de verdade, e sem FK não existe ON DELETE CASCADE (ver
// ai-context/skills/02-data-modeling.md). Toda exclusão de contact/organization
// precisa chamar isto ANTES do delete, ou deixa linha órfã pra sempre.
export async function cleanupPolymorphicReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: "contact" | "organization",
  entityId: string,
) {
  await supabase
    .from("entity_tags")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  const { data: participantRows } = await supabase
    .from("interaction_participants")
    .select("interaction_id")
    .eq("participant_type", entityType)
    .eq("participant_id", entityId);

  await supabase
    .from("interaction_participants")
    .delete()
    .eq("participant_type", entityType)
    .eq("participant_id", entityId);

  // Uma interaction sem nenhum participante restante não é alcançável por
  // nenhuma tela — remove também, em vez de deixar lixo acumulando.
  const interactionIds = [...new Set((participantRows ?? []).map((row) => row.interaction_id))];
  for (const interactionId of interactionIds) {
    const { count } = await supabase
      .from("interaction_participants")
      .select("id", { count: "exact", head: true })
      .eq("interaction_id", interactionId);
    if (!count) {
      await supabase.from("interactions").delete().eq("id", interactionId);
    }
  }
}
