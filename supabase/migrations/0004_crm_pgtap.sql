-- Habilita pgTAP para os testes de RLS em supabase/tests/ (skill 02-data-modeling
-- e 03-security-rls exigem teste de banco cobrindo toda tabela nova). Instalado
-- em `extensions`, nunca em `crm_abvcap` ou `public` (convenção Supabase).
create extension if not exists pgtap with schema extensions;
