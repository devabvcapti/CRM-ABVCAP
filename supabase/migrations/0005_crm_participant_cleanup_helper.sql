-- Helper para cleanupPolymorphicReferences (src/lib/supabase/polymorphic-cleanup.ts).
--
-- Bug real encontrado em code review (PR #10): a policy de SELECT de
-- interaction_participants (interaction_participants_select_inherits_interaction)
-- é filtrada por classification_level/has_grant da interaction, mas as policies
-- de DELETE (interaction_participants_delete_write_roles, interactions_delete_manager)
-- são só por papel (admin/gestor/analista), sem checar classificação. Resultado: um
-- gestor apagando uma organization que é a única participante de uma interaction
-- CONFIDENTIAL/RESTRICTED sem grant explícito — o SELECT de descoberta não via essa
-- linha (RLS escondia), mas o DELETE em lote apagava o participant_row mesmo assim,
-- deixando a interaction órfã (zero participantes) sem nunca ser identificada para
-- limpeza. Fix: função SECURITY DEFINER (mesmo padrão de has_grant/current_profile_id
-- em 0001/0003) que enxerga todas as linhas de interaction_participants, batendo com
-- o que o DELETE em lote de fato já consegue apagar — não com o que o SELECT comum
-- deixaria visível.
create or replace function crm_abvcap.participant_interaction_ids(
  p_participant_type text,
  p_participant_id uuid
)
returns setof uuid
language sql
stable
security definer
set search_path = crm_abvcap, pg_temp
as $$
  select distinct interaction_id
  from crm_abvcap.interaction_participants
  where participant_type = p_participant_type
    and participant_id = p_participant_id;
$$;

-- Idem para a contagem de participantes restantes por interaction: a cleanup
-- precisa saber se uma interaction ficou com zero participantes após o delete em
-- lote, e essa contagem também não pode ser filtrada por classificação (mesmo
-- raciocínio acima).
create or replace function crm_abvcap.interaction_participant_count(p_interaction_id uuid)
returns bigint
language sql
stable
security definer
set search_path = crm_abvcap, pg_temp
as $$
  select count(*)
  from crm_abvcap.interaction_participants
  where interaction_id = p_interaction_id;
$$;
