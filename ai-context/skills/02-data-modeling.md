# Skill: data-modeling-migrations

## Objetivo
Traduzir o modelo de dados (Anexo B do documento normativo) em migrations SQL versionadas e imutáveis no Supabase, gerando tipos estáticos do schema. O modelo de entidades é o ativo mais perene do CRM.

## Pré-condições
- Skill 01 (scaffolding) concluída — projeto Supabase inicializado.
- Skill 03 (security-rls) carregada em paralelo — **nenhuma tabela nasce sem RLS no mesmo arquivo**.
- Anexo B do documento normativo consultado para a entidade em questão.
- **Skills do Claude Code a invocar**: `supabase`, `data:sql-queries`.
- **Documentação via Context7**: `ctx7 library "Supabase" "..."` para sintaxe de migrations, CLI (`supabase gen types`) e particularidades do Postgres gerenciado.

## Implementado em 2026-10-01 — ver antes de mexer em migrations de novo
- Migration `0001_crm_init.sql` já cria `crm_abvcap.user_profiles`, `crm_abvcap.entity_access_grants` e `crm_abvcap.audit_log` (as três tabelas de Fase 0 do Anexo B), todas com RLS + policies no mesmo arquivo. Próximas entidades (`organizations`, `contacts`, `organization_contacts`, etc., Fase 1) entram em migrations novas, nunca editando esta.
- **Expor o schema na API não é suficiente.** Depois de `create schema`, o Postgres ainda nega `42501 permission denied for schema` para `anon`/`authenticated`/`service_role` até rodar `GRANT USAGE ON SCHEMA ...` + `GRANT ALL ON ALL TABLES/ROUTINES/SEQUENCES IN SCHEMA ...` + `ALTER DEFAULT PRIVILEGES ...` (replicado para toda tabela nova automaticamente). Isso está em `0002_crm_grants.sql` — **toda migration de tabela nova em `crm_abvcap` já herda esses grants via `ALTER DEFAULT PRIVILEGES`, não precisa repetir.** RLS continua sendo a única linha de defesa real linha-a-linha; os GRANTs são só o pré-requisito do PostgREST.
- `organization_id` (chave de tenant, ADR-002) por enquanto usa um UUID fixo de tenant único como `default` (não há tabela de tenants ainda — "adormecido" de verdade). Não criar FK para uma tabela de tenants inexistente.
- CLI do Supabase neste projeto é dependência local (`pnpm add -D supabase`), não instalação global — Windows não suporta o binário global oficial. Rodar sempre via `pnpm exec supabase ...`, com `SUPABASE_ACCESS_TOKEN` (Personal Access Token) e `SUPABASE_DB_PASSWORD` como env vars transientes do comando, nunca em arquivo versionado nem em `.env.local`.
- Clients em `src/lib/supabase/{browser,server,admin}.ts` já existem, todos com `db: { schema: 'crm_abvcap' }` explícito. `admin.ts` é protegido com o pacote `server-only`.

## Implementado em 2026-10-02 — núcleo da Fase 1 (`0003_crm_fase1_core.sql`)
- Criadas `organizations`, `contacts`, `organization_contacts`, `interactions`, `interaction_participants`, `tags`, `entity_tags` — exatamente as entidades do DoD de Fase 1 do Anexo B. **Deliberadamente fora desta migration**: `custom_fields`/`custom_field_values` (mecanismo genérico sem demanda concreta ainda — YAGNI, criar quando a primeira necessidade real de atributo dinâmico aparecer) e qualquer tabela de "filtros salvos" (Anexo B não dá nome de tabela para isso; decidir schema só quando essa feature de UI for desenhada).
- **FK para `organizations.id` chama-se `org_id`, nunca `organization_id`** — essa coluna já é reservada em toda tabela para o tenant (ADR-002). Ver `ai-context/domain-glossary.md`.
- **"Cargos exercidos" institucionais de contato (Representante/Palestrante/Conselheiro) são tags**, via `entity_tags` com `entity_type='contact'` — não uma coluna em `contacts`. O "papel exercido" ligado a uma organização específica continua sendo `organization_contacts.role` (conceito diferente, não confundir).
- `entity_type` em `entity_tags`/`interaction_participants` só aceita `'contact'`/`'organization'` — o Anexo B original cita "fundos e eventos", mas "Eventos" foi removido do escopo do projeto (ver `docs/roadmap.md` → Escopo removido). Se Eventos voltar algum dia, isso precisa de nova migration adicionando o valor ao `check`.
- `interactions` é a única tabela de Fase 1 com **classificação por linha** (`classification_level` é coluna, não constante de tabela) — `organizations`/`contacts`/demais ficam fixas em INTERNAL (policy simples `to authenticated`). Novo helper `crm_abvcap.has_grant(entity_type, entity_id)` (também em `SECURITY DEFINER`) existe especificamente para esse padrão de classificação mista — reutilizar em qualquer tabela futura que precise do mesmo (ex.: `tasks`/`boards` na Fase 2, se carregarem classificação própria).
- `interaction_participants` **herda** a visibilidade da `interaction` via subquery na própria policy de SELECT (se não pode ver a interação, não vê quem participou) — padrão a repetir para qualquer tabela de junção ligada a uma entidade com classificação mista.
- `organization_contacts` não tem policy de `DELETE` de propósito — convenção "nunca hard-delete de vínculo, usar `end_date`" (este arquivo, seção Padrões obrigatórios) aplicada a sério, não só documentada.
- Nenhuma migration de grants nova foi necessária — `ALTER DEFAULT PRIVILEGES` de `0002_crm_grants.sql` já cobre toda tabela nova automaticamente (verificado via `curl` direto no REST: `42501` não aparece, resposta é `[]` vazio para o papel `anon`).

## Passos
1. Uma migration numerada por unidade lógica de mudança, com prefixo `crm_` (`NNN_crm_descricao.sql` — ver ADR-006: o histórico de migrations do Supabase CLI é único para todo o projeto, compartilhado com a outra aplicação hospedada nele).
2. Toda migration que cria tabela nova garante o schema primeiro: `create schema if not exists crm_abvcap;`. Toda tabela vive em `crm_abvcap.<nome>`, nunca em `public.<nome>` nem sem o prefixo de schema nas referências (FKs, functions, policies).
3. Toda tabela nova inclui obrigatoriamente: `id UUID DEFAULT uuid_generate_v4()`, `organization_id UUID NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`, `created_by UUID REFERENCES crm_abvcap.user_profiles(id)`.
4. Declarar `ENABLE ROW LEVEL SECURITY` e as policies correspondentes **na mesma migration** (ver skill 03).
5. Rodar `supabase gen types typescript --schema crm_abvcap` e commitar o resultado em `src/types/`.
6. Popular `supabase/seeds/` com dados sintéticos (nunca dados reais de fundos/deals/executivos).
7. Escrever teste de banco em `supabase/tests/` cobrindo constraints e integridade referencial.

## Padrões obrigatórios
- **Imutabilidade**: migration já mesclada na branch principal nunca é editada — correção vira nova migration.
- **Nunca usar `public`**: todo objeto do CRM (tabela, function, view, policy) vive em `crm_abvcap` (ADR-006) — o banco é compartilhado com outra aplicação da ABVCAP.
- Necessidade de atributo pontual por tipo de associado → `custom_fields`/`custom_field_values`, não nova coluna.
- Tabelas polimórficas (`board_cards.related_type/related_id`, `entity_tags`) documentadas explicitamente quanto aos tipos aceitos.
- Toda FK crítica de negócio (`organization_contacts`, `interaction_participants`) preserva histórico — nunca hard-delete de vínculo, usar `end_date`.

## Checklist de aceite
- [ ] Migration aplicada localmente sem erro (`supabase db reset`).
- [ ] Tipos TypeScript regerados e sem `any` residual.
- [ ] Policies de RLS presentes no mesmo arquivo (verificado pela skill 03).
- [ ] Teste de integridade em `supabase/tests/` cobrindo a nova tabela.
- [ ] Seed sintético atualizado, sem dado real.
