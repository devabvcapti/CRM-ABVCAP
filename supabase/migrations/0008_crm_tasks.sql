-- Entidade Tarefa (sub-projeto 1 de 4 — básico, ver
-- docs/superpowers/specs/2026-10-04-tasks-entity-design.md). Reaproveita o
-- padrão polimórfico já resolvido em interactions (0003_crm_fase1_core.sql),
-- mas sem tabela de participantes — uma tarefa é de um participante só.
create table crm_abvcap.tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  participant_type text not null check (participant_type in ('contact', 'organization')),
  participant_id uuid not null,
  description text not null,
  due_date timestamptz not null,
  assigned_to uuid not null references crm_abvcap.user_profiles (id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.tasks is
  'Tarefa vinculada a um Contato ou Organização (participant_type polimórfico, sem tabela de participantes — uma tarefa é de um só). done_at null = pendente, timestamp = concluída (e quando). Sem classification_level: tarefa não é dado sensível como interactions.';

create index tasks_participant_lookup_idx
  on crm_abvcap.tasks (participant_type, participant_id);

create index tasks_due_date_idx on crm_abvcap.tasks (due_date);

create trigger set_updated_at
  before update on crm_abvcap.tasks
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.tasks enable row level security;

create policy tasks_select_authenticated
  on crm_abvcap.tasks
  for select
  to authenticated
  using (true);

create policy tasks_insert_write_roles
  on crm_abvcap.tasks
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy tasks_update_write_roles
  on crm_abvcap.tasks
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy tasks_delete_manager
  on crm_abvcap.tasks
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']));
