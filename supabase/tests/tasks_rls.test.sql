-- RLS de crm_abvcap.tasks (skill 03-security-rls): leitura livre para
-- qualquer autenticado (tarefa não é dado sensível, ver
-- docs/superpowers/specs/2026-10-04-tasks-entity-design.md), escrita
-- restrita por papel — insert/update: admin+gestor+analista; delete:
-- admin+gestor (mesmo padrão de organizations, não a trava extra de
-- contacts). Rodar: ver nota em organizations_rls.test.sql sobre
-- `supabase test db` exigir Docker (indisponível neste ambiente).
begin;
select plan(7);

-- Fixtures: usuários de teste SEM senha (não logam de verdade, só para RLS
-- via request.jwt.claim.sub) — nunca usar para um login real.
insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-00000000c001', 'rls-test-admin3@example.invalid'),
  ('a0000000-0000-0000-0000-00000000c002', 'rls-test-analista3@example.invalid'),
  ('a0000000-0000-0000-0000-00000000c003', 'rls-test-leitura3@example.invalid');

insert into crm_abvcap.user_profiles (auth_id, name, role)
values
  ('a0000000-0000-0000-0000-00000000c001', 'RLS Test Admin 3', 'admin'),
  ('a0000000-0000-0000-0000-00000000c002', 'RLS Test Analista 3', 'analista'),
  ('a0000000-0000-0000-0000-00000000c003', 'RLS Test Leitura 3', 'leitura');

-- Fixture extra: um contact para servir de participant_id das tarefas de
-- teste (organization_id default já cobre o tenant). Inserido antes de
-- qualquer `set local role` — ainda roda com privilégio pleno (bypassa RLS),
-- mesmo momento em que auth.users/user_profiles acima são inseridos.
insert into crm_abvcap.contacts (full_name) values ('RLS Test Task Contact');

-- 1. Analista cria uma tarefa (capacidade "cadastro" do papel).
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c002';
select results_eq(
  $$insert into crm_abvcap.tasks (participant_type, participant_id, description, due_date, assigned_to)
    values (
      'contact',
      (select id from crm_abvcap.contacts where full_name = 'RLS Test Task Contact'),
      'RLS Test Task',
      now() + interval '1 day',
      (select id from crm_abvcap.user_profiles where auth_id = 'a0000000-0000-0000-0000-00000000c002')
    )
    returning description$$,
  array['RLS Test Task'],
  'analista cria tarefa'
);

-- 2. Leitura NÃO pode cadastrar.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c003';
select throws_ok(
  $$insert into crm_abvcap.tasks (participant_type, participant_id, description, due_date, assigned_to)
    values (
      'contact',
      (select id from crm_abvcap.contacts where full_name = 'RLS Test Task Contact'),
      'Tarefa Proibida',
      now() + interval '1 day',
      (select id from crm_abvcap.user_profiles where auth_id = 'a0000000-0000-0000-0000-00000000c003')
    )$$,
  '42501',
  null,
  'leitura não cria tarefa'
);

-- 3. Leitura PODE ler a tarefa criada (INTERNAL = qualquer autenticado).
select ok(
  (select count(*) from crm_abvcap.tasks where description = 'RLS Test Task') = 1,
  'leitura consegue ver a tarefa criada pela analista'
);

-- 4. Analista PODE concluir (update done_at: null -> now()).
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c002';
select results_eq(
  $$update crm_abvcap.tasks set done_at = now()
    where description = 'RLS Test Task'
    returning (done_at is not null)$$,
  array[true],
  'analista conclui a tarefa (done_at passa a não-nulo)'
);

-- 5. Analista NÃO pode excluir (só admin/gestor).
select is_empty(
  $$delete from crm_abvcap.tasks where description = 'RLS Test Task' returning 1$$,
  'analista não exclui tarefa (delete não afeta nenhuma linha)'
);

-- 6. Admin PODE excluir.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c001';
select results_eq(
  $$delete from crm_abvcap.tasks where description = 'RLS Test Task' returning description$$,
  array['RLS Test Task'],
  'admin exclui tarefa'
);

-- 7. insert com participant_type fora de ('contact', 'organization') falha
-- no check constraint (23514), não na policy de RLS (42501).
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000c002';
select throws_ok(
  $$insert into crm_abvcap.tasks (participant_type, participant_id, description, due_date, assigned_to)
    values (
      'invalido',
      (select id from crm_abvcap.contacts where full_name = 'RLS Test Task Contact'),
      'Tarefa Inválida',
      now() + interval '1 day',
      (select id from crm_abvcap.user_profiles where auth_id = 'a0000000-0000-0000-0000-00000000c002')
    )$$,
  '23514',
  null,
  'insert com participant_type inválido falha no check constraint'
);

select * from finish();
rollback;
