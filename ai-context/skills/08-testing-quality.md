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

## Implementado em 2026-10-02 — primeira suíte E2E real (Playwright), dois bugs de verdade pegos por ela
- `e2e/*.spec.ts` + `playwright.config.ts` na raiz — não são mais scripts avulsos (`scratch-*.cjs`) escritos e apagados a cada verificação manual. Rodam no CI (job `e2e` em `.github/workflows/ci.yml`) via `webServer` do Playwright (`next build && next start` local, não contra produção/preview — evita depender do bypass de Deployment Protection do Vercel).
- **Conta de teste dedicada, nunca a conta real**: `qa@abvcap.com.br`, papel `admin` (para poder exercitar toda operação de CRUD pela UI) — bootstrapped do mesmo jeito que o admin real (SQL direto, não migration/seed). Credenciais em secrets do GitHub (`E2E_QA_EMAIL`/`E2E_QA_PASSWORD`), lidas em `e2e/helpers.ts` via `process.env`, nunca hardcoded no teste.
- **Dois bugs reais na aplicação pegos só por rodar os testes de verdade** (não eram esperados, viraram achado real):
  1. **`useActionState` preso em `success: true`**: o form de criar/editar (Organizações e Contatos) reaproveitava a mesma instância de componente entre as duas operações dentro do mesmo `Sheet`. Como o `state.success` do `createOrganization` já ficava `true`, e o `useEffect` que fecha o Sheet depende de `[state.success]`, editar em seguida também retornava `success: true` — mas `true → true` não é uma "mudança" de dependência, o efeito nunca disparava de novo, e o Sheet de edição nunca fechava. Fix: `key={editing?.id ?? "create"}` no form dentro do `Sheet`, forçando o React a desmontar/remontar (e resetar o `useActionState`) a cada abertura. Padrão a repetir em toda tela nova que reusa um form de criar/editar no mesmo `Sheet`.
  2. **Sidebar mobile esconde o "Sair"**: em viewport estreito a sidebar vira um Sheet off-canvas (ADR-003) — o teste de logout precisa clicar em "Toggle Sidebar" antes, se o botão de ação não estiver visível ainda.
- **Rodar testes autenticados em paralelo com a MESMA conta é uma fonte real de flakiness**: logins concorrentes colidem na rotação de refresh token do Supabase Auth, produzindo `ERR_TOO_MANY_REDIRECTS` intermitente. `playwright.config.ts` força `workers: 1` por causa disso — se um dia a suíte crescer e isso virar gargalo, a solução é múltiplas contas de teste, não voltar a paralelizar com uma só.
- Projeto `mobile-chromium` (`devices["Pixel 7"]`) no `playwright.config.ts` cobre o requisito de viewport mobile em pelo menos os fluxos críticos (skill 04/ADR-003).

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
