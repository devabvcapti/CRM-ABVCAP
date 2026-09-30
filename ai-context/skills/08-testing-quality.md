# Skill: testes-e-qualidade

## Objetivo
Executar testes unitários (Vitest), testes de isolamento de RLS no Postgres e testes ponta a ponta (Playwright). Testes constituem a rede de contenção da IA executora — erros em permissão de acesso e concorrência de tarefas causam danos críticos.

## Pré-condições
- Fluxo contínuo, obrigatório a cada PR — não é uma fase isolada.
- Tabela/feature já implementada conforme a skill de domínio correspondente.

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
