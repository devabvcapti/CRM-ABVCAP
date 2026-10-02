-- Prerequisito de nivel Postgres para a API (PostgREST) enxergar o schema
-- dedicado (ADR-006): GRANT de tabela e so o que libera a tentativa de
-- acesso a chegar ate as policies de RLS (0001) — sem isto, toda query via
-- anon/authenticated falha com 42501 antes mesmo de avaliar RLS. O acesso
-- linha-a-linha continua inteiramente controlado pelas policies default-deny
-- ja declaradas em 0001_crm_init.sql.
grant usage on schema crm_abvcap to anon, authenticated, service_role;
grant all privileges on all tables in schema crm_abvcap to anon, authenticated, service_role;
grant all privileges on all routines in schema crm_abvcap to anon, authenticated, service_role;
grant all privileges on all sequences in schema crm_abvcap to anon, authenticated, service_role;

alter default privileges for role postgres in schema crm_abvcap
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema crm_abvcap
  grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema crm_abvcap
  grant all on sequences to anon, authenticated, service_role;
