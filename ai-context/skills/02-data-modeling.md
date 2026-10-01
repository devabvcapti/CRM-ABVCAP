# Skill: data-modeling-migrations

## Objetivo
Traduzir o modelo de dados (Anexo B do documento normativo) em migrations SQL versionadas e imutáveis no Supabase, gerando tipos estáticos do schema. O modelo de entidades é o ativo mais perene do CRM.

## Pré-condições
- Skill 01 (scaffolding) concluída — projeto Supabase inicializado.
- Skill 03 (security-rls) carregada em paralelo — **nenhuma tabela nasce sem RLS no mesmo arquivo**.
- Anexo B do documento normativo consultado para a entidade em questão.
- **Skills do Claude Code a invocar**: `supabase`, `data:sql-queries`.
- **Documentação via Context7**: `ctx7 library "Supabase" "..."` para sintaxe de migrations, CLI (`supabase gen types`) e particularidades do Postgres gerenciado.

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
