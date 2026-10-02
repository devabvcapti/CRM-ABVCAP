-- RLS de crm_abvcap.organization_contacts (skill 03-security-rls): INTERNAL.
-- Particularidade real desta tabela: NENHUMA policy de DELETE existe, de
-- propósito (skill 02-data-modeling — "memória institucional", nunca
-- hard-delete um vínculo, só popular end_date). Este teste confirma que isso
-- vale até para Admin, não é só documentação solta.
begin;
select plan(6);

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000c001', 'rls-test-admin3@example.invalid'),
  ('a0000000-0000-0000-0000-00000000c002', 'rls-test-leitura3@example.invalid');

insert into crm_abvcap.user_profiles (auth_id, name, role)
values
  ('a0000000-0000-0000-0000-00000000c001', 'RLS Test Admin 3', 'admin'),
  ('a0000000-0000-0000-0000-00000000c002', 'RLS Test Leitura 3', 'leitura');

insert into crm_abvcap.organizations (id, name, org_type, tier)
values ('a0000000-0000-0000-0000-00000000c010', 'RLS Test Org For Link', 'fundo_pe', 'B');

insert into crm_abvcap.contacts (id, full_name)
values ('a0000000-0000-0000-0000-00000000c020', 'RLS Test Contact For Link');

set local role anon;
select results_eq(
  $$select count(*) from crm_abvcap.organization_contacts$$,
  $$values (0::bigint)$$,
  'anon vê zero organization_contacts'
);

-- Admin pode criar o vínculo.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c001';
select results_eq(
  $$insert into crm_abvcap.organization_contacts (org_id, contact_id, role, start_date)
    values (
      'a0000000-0000-0000-0000-00000000c010',
      'a0000000-0000-0000-0000-00000000c020',
      'Conselheiro',
      current_date
    )
    returning role$$,
  array['Conselheiro'],
  'admin cria vínculo organization_contacts'
);

-- Leitura não pode criar vínculo.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c002';
select throws_ok(
  $$insert into crm_abvcap.organization_contacts (org_id, contact_id, role, start_date)
    values (
      'a0000000-0000-0000-0000-00000000c010',
      'a0000000-0000-0000-0000-00000000c020',
      'Outro Cargo',
      current_date
    )$$,
  '42501',
  null,
  'leitura não cria vínculo'
);

-- Leitura lê normalmente (INTERNAL).
select ok(
  (select count(*) from crm_abvcap.organization_contacts
    where contact_id = 'a0000000-0000-0000-0000-00000000c020') = 1,
  'leitura vê o vínculo criado pelo admin'
);

-- Admin consegue ENCERRAR o vínculo (UPDATE de end_date) — isso é permitido.
select results_eq(
  $$update crm_abvcap.organization_contacts
    set end_date = current_date
    where contact_id = 'a0000000-0000-0000-0000-00000000c020'
    returning end_date$$,
  $$values (current_date)$$,
  'admin encerra vínculo via end_date (UPDATE)'
);

-- Nem Admin pode fazer hard-delete — não existe policy de DELETE nesta
-- tabela, de propósito (nunca perder histórico de vínculo profissional).
select is_empty(
  $$delete from crm_abvcap.organization_contacts
    where contact_id = 'a0000000-0000-0000-0000-00000000c020'
    returning 1$$,
  'nem admin exclui vínculo — nenhuma policy de DELETE existe nesta tabela'
);

select * from finish();
rollback;
