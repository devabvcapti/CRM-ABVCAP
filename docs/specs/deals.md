# Especificação — Módulo `deals`

- **Status**: Desenhada, mas **adiada** — não faz parte do escopo imediato (decisão do dono do projeto em 2026-09-30). Ver `docs/roadmap.md` → Backlog / adiado. Retomar antes de agendar a migration.
- **ADR relacionado**: `docs/adr/ADR-004-deals-entidade-propria.md`

## Propósito

Registrar inteligência institucional sensível sobre operações em andamento no ecossistema de PE/VC (aquisições, rodadas de investimento, fusões, IPOs) das quais a ABVCAP tem conhecimento por meio de seus associados. **Não é** um funil de vendas da associação — não há estágios comerciais, metas de conversão ou métricas de ganho/perda (fora de escopo da v1, conforme Seção 1.2 do documento normativo).

## Casos de uso

- Um analista da ABVCAP registra que "Fundo X está avaliando aquisição da Empresa Y", vinculando os contatos e organizações envolvidos.
- A equipe consulta, com o devido grant, quais deals estão associados a um determinado GP ou fundo — para preparar uma reunião com contexto de relacionamento.
- A camada de auditoria registra toda leitura desse dado, dado seu nível de confidencialidade.

## Modelo de dados

Ver estrutura completa em ADR-004. Resumo:

- `deals`: 1 registro por operação, com `deal_type`, `status` (ciclo de vida simples: em_andamento/concluído/cancelado), `classification_level` (default `RESTRICTED`), `related_organization_id`.
- `deal_participants`: junção N:N com `contacts` e `organizations`, com `role` (ex.: GP líder, advisor, LP investidor).

## Regras de negócio

- Toda leitura de um `deal` classificado `RESTRICTED` audita em `audit_log` (herda de ADR-001).
- Criação/edição restrita a papéis `Admin` e `Gestor` (a confirmar com a matriz de capacidades de `user_profiles` na Fase 0).
- Um `deal` nunca é excluído fisicamente — apenas `status = cancelado`, preservando a memória institucional.
- Não expor `deals` em busca/listagem para usuários sem grant ativo — nem sua existência (comportamento de RLS default-deny já testado na skill `03-security-rls`).

## Fora de escopo (explicitamente)

- Estágios de funil comercial, probabilidade de fechamento, valor estimado de comissão/fee.
- Qualquer métrica de performance comercial da própria ABVCAP sobre os deals.

## Testes mínimos exigidos (skill `08-testing-quality`)

- RLS: usuário sem grant não vê o registro (nem em contagem agregada).
- RLS: usuário com grant ativo vê o registro e sua leitura é auditada.
- Zod: schema rejeita `deal_type`/`status` fora do enum permitido.
