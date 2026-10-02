-- RLS de crm_abvcap.contacts (skill 03-security-rls): INTERNAL, mas exclusão
-- restrita a Admin (não Gestor) por ser o "direito ao esquecimento" da LGPD
-- (ADR-005) — essa é a diferença real em relação a organizations_rls.test.sql,
-- onde Gestor também pode excluir. Rodar: ver nota em organizations_rls.test.sql
-- sobre `supabase test db` exigir Docker (indisponível neste ambiente).
begin;
select plan(7);

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000b001', 'rls-test-admin2@example.invalid'),
  ('a0000000-0000-0000-0000-00000000b002', 'rls-test-gestor@example.invalid'),
  ('a0000000-0000-0000-0000-00000000b003', 'rls-test-leitura2@example.invalid');

insert into crm_abvcap.user_profiles (auth_id, name, role)
values
  ('a0000000-0000-0000-0000-00000000b001', 'RLS Test Admin 2', 'admin'),
  ('a0000000-0000-0000-0000-00000000b002', 'RLS Test Gestor', 'gestor'),
  ('a0000000-0000-0000-0000-00000000b003', 'RLS Test Leitura 2', 'leitura');

set local role anon;
select results_eq(
  $$select count(*) from crm_abvcap.contacts$$,
  $$values (0::bigint)$$,
  'anon vê zero contacts'
);

-- Gestor pode cadastrar.
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000b002';
select results_eq(
  $$insert into crm_abvcap.contacts (full_name) values ('RLS Test Contact') returning full_name$$,
  array['RLS Test Contact'],
  'gestor cria contact'
);

-- Leitura não pode cadastrar.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000b003';
select throws_ok(
  $$insert into crm_abvcap.contacts (full_name) values ('Contact Proibido')$$,
  '42501',
  null,
  'leitura não cria contact'
);

-- Leitura lê normalmente (INTERNAL).
select ok(
  (select count(*) from crm_abvcap.contacts where full_name = 'RLS Test Contact') = 1,
  'leitura vê o contact criado pelo gestor'
);

-- Gestor NÃO pode excluir contact (diferente de organizations — só Admin).
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000b002';
select is_empty(
  $$delete from crm_abvcap.contacts where full_name = 'RLS Test Contact' returning 1$$,
  'gestor não exclui contact (só admin pode, LGPD)'
);

select ok(
  (select count(*) from crm_abvcap.contacts where full_name = 'RLS Test Contact') = 1,
  'contact segue existindo após tentativa do gestor'
);

-- Admin PODE excluir.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000b001';
select results_eq(
  $$delete from crm_abvcap.contacts where full_name = 'RLS Test Contact' returning full_name$$,
  array['RLS Test Contact'],
  'admin exclui contact'
);

select * from finish();
rollback;
