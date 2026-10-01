# ADR-006: Schema Dedicado `crm_abvcap` e Autenticação Compartilhada

- **Status**: Aceito
- **Data**: 2026-10-01
- **Origem**: decisão do dono do projeto — o mesmo projeto Supabase do CRM vai hospedar também outra aplicação da ABVCAP.

## Contexto

O projeto Supabase criado para o CRM será compartilhado com outra aplicação da ABVCAP, cada uma com seu próprio conjunto de tabelas. Deixar as tabelas do CRM no schema `public` (padrão) arrisca colisão de nomes e mistura responsabilidades entre as duas aplicações no mesmo banco.

Adicionalmente, a autenticação (`auth.users`) é um recurso único por projeto Supabase — não é possível ter dois `auth.users` isolados sem usar dois projetos Supabase distintos. O dono do projeto confirmou que isso é aceitável: as aplicações compartilham o mesmo provedor de autenticação, cada uma resolvendo permissão via sua própria tabela de perfil.

## Decisão

1. **Schema dedicado**: todas as tabelas do CRM vivem no schema `crm_abvcap`, nunca em `public`. Toda migration começa garantindo o schema:
   ```sql
   create schema if not exists crm_abvcap;
   create table crm_abvcap.contacts (...);
   ```
   Tabelas sempre referenciadas com o prefixo (`crm_abvcap.contacts`, não `contacts`) em SQL, functions e policies.

2. **Autenticação única, permissionamento via tabela de perfil**: `auth.users` do projeto Supabase é compartilhado entre as aplicações hospedadas nele. O CRM resolve papel interno e matriz de capacidades através de `crm_abvcap.user_profiles` (já prevista no Anexo B), vinculada por `auth_id uuid references auth.users(id)`. Nenhum sistema de autenticação paralelo é criado. Um usuário pode existir em `auth.users` sem ter uma linha em `crm_abvcap.user_profiles` — nesse caso, não tem acesso a nenhuma funcionalidade do CRM (ausência de perfil = ausência de permissão, default-deny).

3. **Exposição via API**: `crm_abvcap` precisa ser adicionado em Project Settings → API → Exposed schemas para o `supabase-js` conseguir consultá-lo. Os clients do CRM (`src/lib/supabase/{server,browser,admin}.ts`) devem ser instanciados com `db: { schema: 'crm_abvcap' }` explícito — nunca assumir o `public` implícito do client padrão.

4. **Migrations**: como o histórico de migrations do Supabase CLI é único por projeto (não por schema), os arquivos de migration do CRM usam prefixo `crm_` no nome (ex.: `0001_crm_init.sql`) para não se confundir com as migrations da outra aplicação no mesmo repositório de infraestrutura Supabase.

## Consequências

- RLS, grants e a matriz de classificação de dados (ADR-001) continuam exatamente como definidos — aplicam-se normalmente dentro de `crm_abvcap`, só muda o namespace.
- Se no futuro for necessário isolar completamente a autenticação entre as duas aplicações (ex.: bases de usuários totalmente diferentes, sem nenhum overlap), isso exige migrar para um projeto Supabase separado — decisão maior, fora de escopo agora, e que exigiria novo ADR.
- `ai-context/skills/01-scaffolding.md` e `02-data-modeling.md` atualizados para refletir o schema dedicado e a configuração do client.
