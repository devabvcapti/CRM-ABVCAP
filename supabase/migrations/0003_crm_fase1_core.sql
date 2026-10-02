-- CRM ABVCAP — Fase 1 (Núcleo de Relacionamento): organizations, contacts,
-- organization_contacts, interactions, interaction_participants, tags,
-- entity_tags (Anexo B). custom_fields/custom_field_values e saved_searches
-- ficam fora desta migration — mecanismo de extensão genérico sem demanda
-- concreta ainda (YAGNI); criar quando a primeira necessidade real aparecer.

-- Helper de autorização que faltava em 0001: verifica grant ativo em
-- entity_access_grants para o usuário autenticado. Usado pelas policies de
-- classificação mista (ex.: interactions, que carrega seu próprio
-- classification_level por linha, ao contrário de organizations/contacts).
create or replace function crm_abvcap.has_grant(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = crm_abvcap, pg_temp
as $$
  select exists (
    select 1
    from crm_abvcap.entity_access_grants
    where user_id = crm_abvcap.current_profile_id()
      and entity_type = p_entity_type
      and entity_id = p_entity_id
      and revoked_at is null
  );
$$;

-- =============================================================================================
-- organizations — fundos de PE/VC, investidores institucionais, family offices, órgãos
-- reguladores e assessorias parceiras (Anexo B). Nível de classificação: INTERNAL.
-- =============================================================================================
create table crm_abvcap.organizations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  legal_name text,
  org_type text not null check (
    org_type in (
      'fundo_pe', 'fundo_vc', 'investidor_institucional',
      'family_office', 'orgao_regulador', 'assessoria_parceira'
    )
  ),
  tier text not null check (tier in ('A', 'B', 'C')),
  priority_sectors text[] not null default '{}'::text[],
  status text not null check (status in ('ativo', 'inativo')) default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.organizations is
  'Fundos de PE/VC, investidores institucionais, family offices, órgãos reguladores e assessorias parceiras (Anexo B). INTERNAL — não confundir organization_id (tenant, ADR-002) com o id desta tabela.';

create trigger set_updated_at
  before update on crm_abvcap.organizations
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.organizations enable row level security;

create policy organizations_select_authenticated
  on crm_abvcap.organizations
  for select
  to authenticated
  using (auth.uid() is not null);

create policy organizations_insert_write_roles
  on crm_abvcap.organizations
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy organizations_update_write_roles
  on crm_abvcap.organizations
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy organizations_delete_manager
  on crm_abvcap.organizations
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']));

-- =============================================================================================
-- contacts — cadastro central de pessoas físicas do ecossistema (Anexo B).
-- Nível de classificação: INTERNAL. Dados pessoais sob ADR-005 (LGPD).
-- "Cargos exercidos" institucionais (Representante/Palestrante/Conselheiro etc., ver mockup
-- aprovado) são modelados como tags via entity_tags, não como coluna própria — reaproveita o
-- mesmo mecanismo polimórfico de tags/entity_tags do Anexo B em vez de duplicar estrutura.
-- O "papel exercido" ligado a UMA organização específica é organization_contacts.role.
-- =============================================================================================
create table crm_abvcap.contacts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  full_name text not null,
  emails text[] not null default '{}'::text[],
  phones text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.contacts is
  'Pessoas físicas do ecossistema PE/VC (Anexo B). Dados pessoais — ver ADR-005 (LGPD).';

create trigger set_updated_at
  before update on crm_abvcap.contacts
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.contacts enable row level security;

create policy contacts_select_authenticated
  on crm_abvcap.contacts
  for select
  to authenticated
  using (auth.uid() is not null);

create policy contacts_insert_write_roles
  on crm_abvcap.contacts
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy contacts_update_write_roles
  on crm_abvcap.contacts
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

-- Exclusão de contato é o próprio "direito ao esquecimento" da LGPD (ADR-005) — por isso
-- fica restrita a Admin (não Gestor), e toda exclusão real já cai em audit_log (trigger
-- futuro, quando o fluxo de atendimento a titulares for desenhado na Fase 1).
create policy contacts_delete_admin
  on crm_abvcap.contacts
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin']));

-- =============================================================================================
-- organization_contacts — vínculo muitos-para-muitos entre contacts e organizations, com
-- histórico de papéis (Anexo B). "Memória institucional": nunca hard-delete, usar end_date
-- (skill 02-data-modeling) — por isso não existe policy de DELETE aqui.
-- FK para organizations chama-se "org_id" (não "organization_id") de propósito: todo tabela já
-- tem sua própria coluna organization_id de tenant (ADR-002) — usar o mesmo nome para a FK de
-- negócio colidiria. Ver nota em ai-context/domain-glossary.md.
-- =============================================================================================
create table crm_abvcap.organization_contacts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  contact_id uuid not null references crm_abvcap.contacts (id) on delete cascade,
  org_id uuid not null references crm_abvcap.organizations (id) on delete cascade,
  role text not null,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id),
  constraint organization_contacts_dates_check check (end_date is null or end_date >= start_date)
);

comment on table crm_abvcap.organization_contacts is
  'Histórico de vínculos pessoa↔organização (papel + start_date/end_date). Nunca hard-delete — encerrar vínculo é popular end_date.';

create index organization_contacts_contact_idx on crm_abvcap.organization_contacts (contact_id);
create index organization_contacts_org_idx on crm_abvcap.organization_contacts (org_id);

create trigger set_updated_at
  before update on crm_abvcap.organization_contacts
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.organization_contacts enable row level security;

create policy organization_contacts_select_authenticated
  on crm_abvcap.organization_contacts
  for select
  to authenticated
  using (auth.uid() is not null);

create policy organization_contacts_insert_write_roles
  on crm_abvcap.organization_contacts
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy organization_contacts_update_write_roles
  on crm_abvcap.organization_contacts
  for update
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

-- =============================================================================================
-- interactions — registro cronológico de interações institucionais (Anexo B). Única tabela de
-- Fase 1 com classificação por LINHA (classification_level é uma coluna, não uma constante de
-- tabela) — RLS default-deny para confidential/restricted via entity_access_grants (ADR-001).
-- RESTRICTED aqui ainda não precisa de leitura auditada (skill 03): não há dado RESTRICTED
-- real em Fase 1 (deals, o principal candidato, está no backlog) — revisitar quando existir.
-- =============================================================================================
create table crm_abvcap.interactions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  type text not null check (type in ('reuniao', 'email', 'chamada', 'evento_associativo')),
  occurred_at timestamptz not null,
  summary text not null,
  classification_level text not null check (
    classification_level in ('public', 'internal', 'confidential', 'restricted')
  ) default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id)
);

comment on table crm_abvcap.interactions is
  'Timeline de interações institucionais (reunião/e-mail/chamada/evento associativo). classification_level é por linha — ver ADR-001.';

create index interactions_occurred_at_idx on crm_abvcap.interactions (occurred_at desc);

create trigger set_updated_at
  before update on crm_abvcap.interactions
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.interactions enable row level security;

create policy interactions_select_classified
  on crm_abvcap.interactions
  for select
  to authenticated
  using (
    classification_level in ('public', 'internal')
    or crm_abvcap.has_role(array['admin'])
    or crm_abvcap.has_grant('interactions', id)
  );

create policy interactions_insert_write_roles
  on crm_abvcap.interactions
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy interactions_update_write_roles
  on crm_abvcap.interactions
  for update
  to authenticated
  using (
    classification_level in ('public', 'internal')
    or crm_abvcap.has_role(array['admin'])
    or crm_abvcap.has_grant('interactions', id)
  )
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy interactions_delete_manager
  on crm_abvcap.interactions
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor']));

-- =============================================================================================
-- interaction_participants — junção poliforma que vincula contacts e organizations a uma
-- interaction (Anexo B). Visibilidade herdada da interaction referenciada (se não pode ver a
-- interação, não pode ver quem participou dela).
-- =============================================================================================
create table crm_abvcap.interaction_participants (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  interaction_id uuid not null references crm_abvcap.interactions (id) on delete cascade,
  participant_type text not null check (participant_type in ('contact', 'organization')),
  participant_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id),
  constraint interaction_participants_unique unique (interaction_id, participant_type, participant_id)
);

comment on table crm_abvcap.interaction_participants is
  'Vincula contacts/organizations (participant_type polimórfico) a uma interaction. Visibilidade herdada da interaction.';

create index interaction_participants_lookup_idx
  on crm_abvcap.interaction_participants (participant_type, participant_id);

create trigger set_updated_at
  before update on crm_abvcap.interaction_participants
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.interaction_participants enable row level security;

create policy interaction_participants_select_inherits_interaction
  on crm_abvcap.interaction_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from crm_abvcap.interactions i
      where i.id = interaction_participants.interaction_id
        and (
          i.classification_level in ('public', 'internal')
          or crm_abvcap.has_role(array['admin'])
          or crm_abvcap.has_grant('interactions', i.id)
        )
    )
  );

create policy interaction_participants_insert_write_roles
  on crm_abvcap.interaction_participants
  for insert
  to authenticated
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create policy interaction_participants_delete_write_roles
  on crm_abvcap.interaction_participants
  for delete
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

-- =============================================================================================
-- tags / entity_tags — taxonomia polimórfica transversal (Anexo B). Escopo restrito a contacts
-- e organizations: "eventos" foi removido do escopo do projeto (ver docs/roadmap.md → Escopo
-- removido), então entity_type não inclui 'event' apesar do texto original do Anexo B citar
-- "fundos e eventos". Nível de classificação: INTERNAL (rótulos, não dado sensível em si).
-- =============================================================================================
create table crm_abvcap.tags (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id),
  constraint tags_name_unique_per_tenant unique (organization_id, name)
);

comment on table crm_abvcap.tags is
  'Taxonomia transversal (Anexo B). Inclui os badges institucionais de contato (Representante/Palestrante/etc.) via entity_tags.';

create trigger set_updated_at
  before update on crm_abvcap.tags
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.tags enable row level security;

create policy tags_select_authenticated
  on crm_abvcap.tags
  for select
  to authenticated
  using (auth.uid() is not null);

create policy tags_write_roles
  on crm_abvcap.tags
  for all
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));

create table crm_abvcap.entity_tags (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',
  tag_id uuid not null references crm_abvcap.tags (id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'organization')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references crm_abvcap.user_profiles (id),
  constraint entity_tags_unique unique (tag_id, entity_type, entity_id)
);

comment on table crm_abvcap.entity_tags is
  'Aplicação polimórfica de uma tag a um contact ou organization.';

create index entity_tags_lookup_idx on crm_abvcap.entity_tags (entity_type, entity_id);

create trigger set_updated_at
  before update on crm_abvcap.entity_tags
  for each row execute function crm_abvcap.set_updated_at();

alter table crm_abvcap.entity_tags enable row level security;

create policy entity_tags_select_authenticated
  on crm_abvcap.entity_tags
  for select
  to authenticated
  using (auth.uid() is not null);

create policy entity_tags_write_roles
  on crm_abvcap.entity_tags
  for all
  to authenticated
  using (crm_abvcap.has_role(array['admin', 'gestor', 'analista']))
  with check (crm_abvcap.has_role(array['admin', 'gestor', 'analista']));
