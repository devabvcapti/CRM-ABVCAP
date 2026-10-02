# Skill: testes-e-qualidade

## Objetivo
Executar testes unitários (Vitest), testes de isolamento de RLS no Postgres e testes ponta a ponta (Playwright). Testes constituem a rede de contenção da IA executora — erros em permissão de acesso e concorrência de tarefas causam danos críticos.

## Pré-condições
- Fluxo contínuo, obrigatório a cada PR — não é uma fase isolada.
- Tabela/feature já implementada conforme a skill de domínio correspondente.
- **Skills do Claude Code a invocar**: `playwright-cli`, `test-driven-development`, `unit-testing:test-generate`.
- **Documentação via Context7**: `ctx7 library "Vitest" "..."` / `ctx7 library "Playwright" "..."` para APIs de mock, fixtures e asserções.

## Implementado em 2026-10-02 — primeiro teste de RLS real, ver antes de escrever o próximo
- `supabase/tests/organizations_rls.test.sql` é o primeiro teste de RLS do projeto (pgTAP) — segue exatamente o padrão da doc oficial do Supabase (`set local role ...` + `set local request.jwt.claim.sub = '<uuid>'` para simular cada papel, nunca login real). Fixtures são linhas de `auth.users`/`user_profiles` **sem senha** (não logam de verdade, só servem pra RLS resolver `auth.uid()`), inseridas e testadas dentro de `begin ... rollback` — nunca persistem.
- `supabase test db` (o runner oficial da CLI) **exige o stack local via Docker**, indisponível neste ambiente de desenvolvimento (Windows sem Docker/Podman). Alternativa usada: aplicar o mesmo SQL do teste diretamente contra o banco remoto via conexão Postgres direta (pooler, com a senha do banco — nunca a service_role key), dentro de uma transação que termina em `rollback`. Resultado real obtido assim (9/9 `ok`): `anon vê zero / analista cria / leitura não cria (42501) / leitura lê / leitura não edita / analista não exclui / admin exclui`. Reavaliar quando Docker estiver disponível (CI, ou ambiente de dev diferente) para rodar via `supabase test db` de verdade.
- Extensão `pgtap` habilitada via `0004_crm_pgtap.sql` (`create extension ... with schema extensions`) — pré-requisito para qualquer teste pgTAP, tanto local quanto remoto.
- Padrão a repetir para toda tabela nova com RLS: um arquivo `supabase/tests/<tabela>_rls.test.sql`, cobrindo no mínimo — anon vazio (não erro), cada papel que deveria conseguir escrever consegue, cada papel que não deveria não consegue (via `throws_ok` 42501 para INSERT, `is_empty` para UPDATE/DELETE que a policy silenciosamente não afeta).

## Passos
1. Teste unitário (Vitest) para toda regra de negócio em `src/modules/*/services/`.
2. Teste de RLS em `supabase/tests/` para toda tabela nova ou policy alterada — cenário positivo (com grant) e negativo (sem grant, retorno vazio).
3. Teste E2E (Playwright) para fluxos críticos: autenticação, cadastro de entidades, ciclo de tarefas, Kanban.
4. Incluir viewport mobile em ao menos os fluxos críticos de E2E (não só desktop).
5. Rodar toda a suíte na esteira de CI antes de permitir merge.

## Padrões obrigatórios
- Nenhum PR de regra de negócio sem teste unitário correspondente.
- Nenhuma policy de RLS sem teste negativo explícito.
- Testes de banco usam dados sintéticos de `supabase/seeds/` — nunca dados reais.

## Checklist de aceite
- [ ] Cobertura de teste unitário nas services alteradas.
- [ ] Teste de RLS positivo e negativo presentes e passando.
- [ ] Suíte E2E cobrindo o fluxo crítico afetado, incluindo viewport mobile.
- [ ] CI verde antes do merge — falha em qualquer etapa bloqueia.
