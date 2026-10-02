-- CRM ABVCAP — migration fundacional da Fase 0.
-- Schema dedicado (ADR-006), premissa de modelagem obrigatoria (Anexo B: id/organization_id/
-- created_at/updated_at/created_by em toda tabela) e RLS default-deny (ADR-001) na mesma migration
-- em que cada tabela nasce (skills 02-data-modeling e 03-security-rls).

create schema if not exists crm_abvcap;

create extension if not exists "uuid-ossp";

-- organization_id e a chave de tenant da arquitetura multi-tenant adormecida (ADR-002), nao a
-- entidade de negocio "organizations" (fundos/empresas) do Anexo B, que sera criada na Fase 1.
-- Hoje ha um unico tenant efetivo (ABVCAP); este UUID fixo e o valor usado em toda linha ate que
-- a v1 exponha troca de tenant na UI.
comment on schema crm_abvcap is
  'Schema dedicado do CRM ABVCAP (ADR-006) — banco compartilhado com outra aplicacao da ABVCAP.';

-- Função utilitária de updated_at, aplicada via trigger em toda tabela mutável deste schema.
create or replace function crm_abvcap.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================================
-- user_profiles — extensão de auth.users com dados do operador do CRM (Anexo B).
-- Nível de classificação: INTERNAL (ADR-001) — qualquer operador autenticado pode consultar.
-- =============================================================================================
create table crm_abvcap.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  auth_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  avatar_url text,
  role text not null check (role in ('admin', 'gestor', 'analista', 'leitura')),
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- auto-referência: null para o(s) primeiro(s) perfil(is) criado(s) via bootstrap (service role).
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.user_profiles is
  'Perfil de operador do CRM: papel interno + matriz de capacidades. Ausência de linha aqui = ausência de permissão (default-deny, ADR-006).';

create trigger set_updated_at
  before update on crm_abvcap.user_profiles
  for each row execute function crm_abvcap.set_updated_at();

-- Funções auxiliares SECURITY DEFINER: resolvem o perfil/papel do usuário autenticado sem
-- disparar recursão nas próprias policies de RLS de user_profiles.
create or replace function crm_abvcap.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = crm_abvcap, pg_temp
as $$
  select id from crm_abvcap.user_profiles where auth_id = auth.uid();
$$;

create or replace function crm_abvcap.has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = crm_abvcap, pg_temp
as $$
  select exists (
    select 1
    from crm_abvcap.user_profiles
    where auth_id = auth.uid()
      and role = any(required_roles)
  );
$$;

alter table crm_abvcap.user_profiles enable row level security;

-- INTERNAL: todo operador autenticado (com perfil) pode ler o diretório de perfis.
create policy user_profiles_select_authenticated
  on crm_abvcap.user_profiles
  for select
  to authenticated
  using (auth.uid() is not null);

-- Apenas Admin cria novos perfis (fluxo normal passa pelo client admin/service role, que
-- ignora RLS; esta policy é defesa em profundidade para chamadas autenticadas diretas).
create policy user_profiles_insert_admin
  on crm_abvcap.user_profiles
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin']));

-- Usuário edita o próprio perfil (nome/avatar); Admin edita qualquer perfil (papel/capacidades).
create policy user_profiles_update_self_or_admin
  on crm_abvcap.user_profiles
  for update
  to authenticated
  using (auth_id = auth.uid() or crm_abvcap.has_role(array['admin']))
  with check (auth_id = auth.uid() or crm_abvcap.has_role(array['admin']));

create policy user_profiles_delete_admin
  on crm_abvcap.user_profiles
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin']));

-- =============================================================================================
-- entity_access_grants — concessão excepcional de acesso a uma entidade CONFIDENTIAL/RESTRICTED
-- (Anexo B + ADR-001). Nível de classificação: CONFIDENTIAL (controla acesso a dado sensível).
-- entity_type/entity_id são polimórficos — apontam para a tabela/linha concedida (ex.: 'deals').
-- =============================================================================================
create table crm_abvcap.entity_access_grants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  user_id uuid not null references crm_abvcap.user_profiles (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  classification_level text not null check (classification_level in ('confidential', 'restricted')),
  granted_by uuid not null references crm_abvcap.user_profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.entity_access_grants is
  'Controle de acesso excepcional por entidade (CONFIDENTIAL/RESTRICTED). Grant ativo = revoked_at is null.';

create index entity_access_grants_lookup
  on crm_abvcap.entity_access_grants (user_id, entity_type, entity_id)
  where revoked_at is null;

create trigger set_updated_at
  before update on crm_abvcap.entity_access_grants
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.entity_access_grants enable row level security;

-- Default-deny: usuário só vê os próprios grants; Admin/Gestor administram todos (Anexo B/ADR-001).
create policy entity_access_grants_select_self_or_manager
  on crm_abvcap.entity_access_grants
  for select
  to authenticated
  using (user_id = crm_abvcap.current_profile_id() or crm_abvcap.has_role(array['admin', 'gestor']));

create policy entity_access_grants_insert_manager
  on crm_abvcap.entity_access_grants
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor']));

create policy entity_access_grants_update_manager
  on crm_abvcap.entity_access_grants
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']))
  with check (crm_abvcap.has_role(array['admin', 'gestor']));

create policy entity_access_grants_delete_manager
  on crm_abvcap.entity_access_grants
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']));

-- =============================================================================================
-- audit_log — registro imutável de criação/atualização/exclusão e de toda leitura de dado
-- RESTRICTED (Anexo B + ADR-001). Sem policy de UPDATE/DELETE: com RLS ativo, nenhuma role da
-- API (authenticated/anon) pode alterar ou apagar uma linha — apenas o service role (bootstrap/
-- correção excepcional) contorna RLS, preservando a imutabilidade.
-- =============================================================================================
create table crm_abvcap.audit_log (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  actor_id uuid references crm_abvcap.user_profiles (id),
  action text not null check (action in ('insert', 'update', 'delete', 'read')),
  entity_type text not null,
  entity_id uuid not null,
  classification_level text not null check (
    classification_level in ('public', 'internal', 'confidential', 'restricted')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- mantidas por consistência com a premissa obrigatória de modelagem (Anexo B); nunca
  -- atualizadas de fato — tabela não recebe trigger de updated_at por ser imutável.
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.audit_log is
  'Log imutável de mutações e de leituras de dado RESTRICTED. Nenhuma policy de UPDATE/DELETE é declarada de propósito.';

create index audit_log_entity_lookup
  on crm_abvcap.audit_log (entity_type, entity_id, created_at desc);

alter table crm_abvcap.audit_log enable row level security;

-- Apenas Admin lê o audit log (metadado sensível sobre acesso a RESTRICTED).
create policy audit_log_select_admin
  on crm_abvcap.audit_log
  for select
  to authenticated
  using (crm_abvcap.has_role(array['admin']));

-- Qualquer operador autenticado pode gravar seu próprio evento de auditoria (a aplicação grava
-- no momento da ação); atribuição ao ator é reforçada pela policy, não apenas pelo app.
create policy audit_log_insert_self
  on crm_abvcap.audit_log
  for insert
  to authenticated
  with check (actor_id = crm_abvcap.current_profile_id());
