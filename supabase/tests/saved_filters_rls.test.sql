-- RLS de crm_abvcap.saved_filters (skill 03-security-rls): ownership-based, não por papel —
-- diferente de organizations/contacts, aqui não existe noção de "INTERNAL" compartilhado:
-- cada saved_filters pertence a exatamente um operador (user_profile_id = dono), papel do
-- usuário é irrelevante. Rodar: mesmo processo de organizations_rls.test.sql/contacts_rls.test.sql
-- (sem Docker local disponível neste ambiente de desenvolvimento) — aplicar este arquivo
-- manualmente num client Postgres contra o projeto remoto, dentro de uma transação que
-- termina em rollback.
begin;
select plan(7);

-- Fixtures: usuários de teste SEM senha (não logam de verdade, só para RLS via
-- request.jwt.claim.sub) — nunca usar para um login real. Papel é irrelevante aqui
-- (posse, não papel), mas a coluna exige um valor válido do check constraint.
insert into auth.users (id, email)
values
  ('c0000000-0000-0000-0000-00000000c001', 'rls-test-filtro-a@example.invalid'),
  ('c0000000-0000-0000-0000-00000000c002', 'rls-test-filtro-b@example.invalid');

insert into crm_abvcap.user_profiles (auth_id, name, role)
values
  ('c0000000-0000-0000-0000-00000000c001', 'RLS Test Filtro A', 'analista'),
  ('c0000000-0000-0000-0000-00000000c002', 'RLS Test Filtro B', 'analista');

set local role authenticated;

-- 1. Usuário A insere um saved_filters próprio — sucesso.
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000c001';
select results_eq(
  $$insert into crm_abvcap.saved_filters (user_profile_id, entity_type, name, filter_state)
    values (crm_abvcap.current_profile_id(), 'contact', 'Meu Filtro', '{"q": "teste"}'::jsonb)
    returning name$$,
  array['Meu Filtro'],
  'usuário A insere o próprio saved_filters'
);

-- 2. Usuário A lê o próprio filtro — aparece.
select ok(
  (select count(*) from crm_abvcap.saved_filters where name = 'Meu Filtro') = 1,
  'usuário A vê o próprio filtro salvo'
);

-- 3. Usuário B (outro user_profile_id) tenta ler os filtros — zero linhas, mesmo existindo
-- a linha de A (RLS filtra silenciosamente, não é erro).
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000c002';
select results_eq(
  $$select count(*) from crm_abvcap.saved_filters$$,
  $$values (0::bigint)$$,
  'usuário B não vê nenhum saved_filters (não é dono de nenhum)'
);

-- 4. Usuário B tenta update numa linha do usuário A pelo id — zero linhas afetadas
-- (RLS barra via using, não é erro 42501).
select is_empty(
  $$update crm_abvcap.saved_filters set name = 'Sequestrado'
    where name = 'Meu Filtro' returning 1$$,
  'usuário B não edita o filtro do usuário A (update não afeta nenhuma linha)'
);

-- 5. Usuário B tenta delete numa linha do usuário A — zero linhas afetadas.
select is_empty(
  $$delete from crm_abvcap.saved_filters where name = 'Meu Filtro' returning 1$$,
  'usuário B não exclui o filtro do usuário A (delete não afeta nenhuma linha)'
);

-- 6. Usuário A apaga o próprio filtro — sucesso, linha some.
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000c001';
select results_eq(
  $$delete from crm_abvcap.saved_filters where name = 'Meu Filtro' returning name$$,
  array['Meu Filtro'],
  'usuário A exclui o próprio filtro salvo'
);

-- 7. Inserir dois filtros com o mesmo (user_profile_id, entity_type, name) — unique_violation
-- (23505). Linha-base inserida fora do plano (statement simples, não é uma asserção pgTAP);
-- a asserção em si é só a tentativa de duplicar.
insert into crm_abvcap.saved_filters (user_profile_id, entity_type, name, filter_state)
values (crm_abvcap.current_profile_id(), 'organization', 'Duplicado', '{}'::jsonb);

select throws_ok(
  $$insert into crm_abvcap.saved_filters (user_profile_id, entity_type, name, filter_state)
    values (crm_abvcap.current_profile_id(), 'organization', 'Duplicado', '{}'::jsonb)$$,
  '23505',
  null,
  'não permite dois saved_filters com o mesmo (user_profile_id, entity_type, name)'
);

select * from finish();
rollback;
