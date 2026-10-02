-- RLS de crm_abvcap.organizations (skill 03-security-rls): INTERNAL — leitura
-- livre para qualquer autenticado, escrita restrita por papel interno.
-- Rodar: supabase test db (requer stack local via Docker) ou aplicar este
-- arquivo manualmente num client Postgres contra o projeto (sem Docker local
-- disponível neste ambiente de desenvolvimento, foi assim que foi verificado
-- pela primeira vez — ver docs/roadmap.md).
begin;
select plan(9);

-- Fixtures: usuários de teste SEM senha (não logam de verdade, só para RLS
-- via request.jwt.claim.sub) — nunca usar para um login real.
insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000a001', 'rls-test-admin@example.invalid'),
  ('a0000000-0000-0000-0000-00000000a002', 'rls-test-analista@example.invalid'),
  ('a0000000-0000-0000-0000-00000000a003', 'rls-test-leitura@example.invalid');

insert into crm_abvcap.user_profiles (auth_id, name, role)
values
  ('a0000000-0000-0000-0000-00000000a001', 'RLS Test Admin', 'admin'),
  ('a0000000-0000-0000-0000-00000000a002', 'RLS Test Analista', 'analista'),
  ('a0000000-0000-0000-0000-00000000a003', 'RLS Test Leitura', 'leitura');

-- anon: GRANT cobre a tabela (0002), mas nenhuma policy é `to anon` — retorna
-- vazio, nunca erro (não vaza existência de dado, ver ADR-001).
set local role anon;
select results_eq(
  $$select count(*) from crm_abvcap.organizations$$,
  $$values (0::bigint)$$,
  'anon vê zero organizations (sem policy, não é erro)'
);

-- Analista pode cadastrar (capacidade "cadastro" do papel, domain-glossary.md).
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000a002';
select results_eq(
  $$insert into crm_abvcap.organizations (name, org_type, tier)
    values ('RLS Test Org', 'fundo_pe', 'B')
    returning name$$,
  array['RLS Test Org'],
  'analista cria organization'
);

-- Leitura NÃO pode cadastrar.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000a003';
select throws_ok(
  $$insert into crm_abvcap.organizations (name, org_type, tier)
    values ('Org Proibida', 'fundo_vc', 'C')$$,
  '42501',
  null,
  'leitura não cria organization'
);

-- Leitura PODE ler (INTERNAL = qualquer autenticado).
select ok(
  (select count(*) from crm_abvcap.organizations where name = 'RLS Test Org') = 1,
  'leitura consegue ver a organization criada pelo analista'
);

-- Leitura NÃO pode editar.
select is_empty(
  $$update crm_abvcap.organizations set tier = 'A' where name = 'RLS Test Org' returning 1$$,
  'leitura não edita organization (update não afeta nenhuma linha)'
);

-- Analista NÃO pode excluir (só admin/gestor).
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000a002';
select is_empty(
  $$delete from crm_abvcap.organizations where name = 'RLS Test Org' returning 1$$,
  'analista não exclui organization (delete não afeta nenhuma linha)'
);

select ok(
  (select count(*) from crm_abvcap.organizations where name = 'RLS Test Org') = 1,
  'organization segue existindo após tentativa de delete do analista'
);

-- Admin PODE excluir.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000a001';
select results_eq(
  $$delete from crm_abvcap.organizations where name = 'RLS Test Org' returning name$$,
  array['RLS Test Org'],
  'admin exclui organization'
);

select ok(
  (select count(*) from crm_abvcap.organizations where name = 'RLS Test Org') = 0,
  'organization realmente removida após delete do admin'
);

select * from finish();
rollback;
