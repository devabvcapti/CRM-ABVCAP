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

  // A policy de SELECT de interaction_participants é filtrada por
  // classification_level/has_grant da interaction, mas as policies de DELETE
  // são só por papel (admin/gestor/analista), sem checar classificação — um
  // .select() comum aqui perderia interactions CONFIDENTIAL/RESTRICTED que o
  // .delete() abaixo apaga de qualquer forma, deixando-as órfãs sem nunca
  // serem detectadas. participant_interaction_ids é SECURITY DEFINER
  // justamente para enxergar tudo que o DELETE em lote também enxerga.
  const { data: interactionIds } = await supabase.rpc("participant_interaction_ids", {
    p_participant_type: entityType,
    p_participant_id: entityId,
  });

  await supabase
    .from("interaction_participants")
    .delete()
    .eq("participant_type", entityType)
    .eq("participant_id", entityId);

  // Uma interaction sem nenhum participante restante não é alcançável por
  // nenhuma tela — remove também, em vez de deixar lixo acumulando.
  // interaction_participant_count é SECURITY DEFINER pelo mesmo motivo acima
  // (contagem não pode ser filtrada por classificação) e expõe erro de forma
  // explícita em vez de um `count` nulo ser tratado como zero.
  for (const interactionId of new Set(interactionIds ?? [])) {
    const { data: count, error } = await supabase.rpc("interaction_participant_count", {
      p_interaction_id: interactionId,
    });
    if (!error && count === 0) {
      await supabase.from("interactions").delete().eq("id", interactionId);
    }
  }
}
