-- saved_filters — persistência pessoal de filtros salvos por operador (Fase 1, busca +
-- filtros salvos em Contatos/Organizações). RLS por POSSE (user_profile_id = dono), não por
-- papel — diferente de organizations/contacts: aqui não há noção de "INTERNAL" compartilhado,
-- cada filtro salvo pertence a exatamente um operador (crm_abvcap.current_profile_id()).
create table crm_abvcap.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references crm_abvcap.user_profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'organization')),
  name text not null,
  filter_state jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_profile_id, entity_type, name)
);

alter table crm_abvcap.saved_filters enable row level security;

create policy saved_filters_select_own
  on crm_abvcap.saved_filters for select to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_insert_own
  on crm_abvcap.saved_filters for insert to authenticated
  with check (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_update_own
  on crm_abvcap.saved_filters for update to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id())
  with check (user_profile_id = crm_abvcap.current_profile_id());

create policy saved_filters_delete_own
  on crm_abvcap.saved_filters for delete to authenticated
  using (user_profile_id = crm_abvcap.current_profile_id());
