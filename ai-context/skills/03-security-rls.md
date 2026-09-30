# Skill: security-rls

## Objetivo
Escrever e testar policies de Row Level Security, implementar a matriz de classificação de dados em 4 níveis e o controle de grants/auditoria. Requisito de negócio central (ADR-001), não elemento opcional — dados de fundos e deals exigem confidencialidade irrestrita.

## Pré-condições
- `docs/adr/ADR-001-classificacao-dados-e-rls.md` lido.
- Tabela em questão já definida (skill 02) com `organization_id`.
- Tabela `entity_access_grants` e `audit_log` existentes (Fase 0).
- **Skills do Claude Code a invocar**: `supabase`, `security-review`.
- **Documentação via Context7**: `ctx7 library "Supabase" "Row Level Security policies"` para sintaxe atual de `CREATE POLICY` e funções auxiliares (`auth.uid()`, etc.).

## Passos
1. Classificar a tabela/coluna em um dos 4 níveis: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`.
2. `ENABLE ROW LEVEL SECURITY` — sem exceção, mesmo para tabelas aparentemente públicas.
3. Escrever policy default-deny para `CONFIDENTIAL`/`RESTRICTED`: acesso somente com registro ativo em `entity_access_grants` para aquele usuário + entidade.
4. Para `PUBLIC`/`INTERNAL`: policy simples de `authenticated`.
5. Para tabelas com dados `RESTRICTED`: trigger ou função que grava em `audit_log` a cada `SELECT`/leitura relevante (via view/function intermediária, já que `SELECT` puro não dispara trigger nativamente — avaliar `security definer` function de leitura auditada).
6. Escrever teste negativo em `supabase/tests/`: usuário sem grant deve receber conjunto vazio, nunca erro que vaze existência do registro.

## Padrões obrigatórios
- **Default-deny** para `CONFIDENTIAL` e `RESTRICTED` — nunca allow-list implícita.
- Isolamento aplicado **no motor do Postgres**; proibida qualquer dependência de filtro no cliente/UI para segurança.
- Nenhuma migration de tabela nova sem policy no mesmo arquivo — bloqueia o deploy.
- Dados `RESTRICTED` nunca são incluídos em embeddings ou prompts de IA sem opt-in explícito e logado por entidade (gate da Fase 4).

## Checklist de aceite
- [ ] RLS habilitado em 100% das tabelas do domínio.
- [ ] Teste automatizado comprova bloqueio sem grant ativo (retorno vazio, não erro).
- [ ] Teste automatizado comprova acesso correto com grant ativo.
- [ ] Leitura de registro `RESTRICTED` gera entrada em `audit_log`.
- [ ] Revisão manual (par ou humano) da policy antes do merge.
