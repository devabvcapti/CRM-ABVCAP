# AGENTS.md — Ponto de Entrada Mandatório

> Todo agente de IA (ou desenvolvedor humano) deve ler este arquivo integralmente antes de tocar em qualquer código ou migration deste repositório.

## 1. O que é este projeto

CRM de **inteligência de relacionamento** (relationship intelligence) para a ABVCAP (Associação Brasileira de Private Equity e Venture Capital). Não é um CRM de vendas — não há funil comercial, pipeline de propostas ou portal de autoatendimento na v1.

Eixo central: a entidade de **relacionamento** (histórico de conexões, papéis, temperatura de contato), não a oportunidade de venda.

**Repositório de referência**: `atomic-crm/` (raiz do projeto, gitignored) é um clone fixado do [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) (commit `a863e2a0`), um CRM open-source em React + Supabase. Serve como consulta de padrões de arquitetura/Supabase durante a Fase 0/1 — **nunca** é parte do nosso código nem deve ser copiado literalmente; qualquer padrão aproveitado deve ser adaptado ao nosso modelo de dados (Anexo B) e às nossas regras de RLS/classificação (ADR-001).

Documento normativo completo: [`../ARQUITERURA/Uso interno — Documento de planejamento.docx`](../ARQUITERURA/Uso%20interno%20—%20Documento%20de%20planejamento.docx) (v1.0, 2026-09-29). Este diretório (`ai-context/`) e `docs/` são a tradução operacional desse documento em artefatos versionados. Em caso de conflito, o documento normativo prevalece até que um ADR o substitua formalmente.

## 2. Protocolo determinístico de execução

1. **Leitura de contexto mestre** — este arquivo + o documento normativo — antes de gerar qualquer arquivo ou migration.
2. **Consulta ao playbook da skill correspondente** em `ai-context/skills/` e a `ai-context/conventions.md` antes de iniciar qualquer tarefa técnica. Cada playbook lista, em "Pré-condições", quais **Skills do Claude Code** (ferramenta `Skill`) devem ser invocadas de fato durante aquela tarefa (ex.: `supabase`, `shadcn`, `vercel:nextjs`, `playwright-cli`) — o playbook é o "o quê/por quê" do projeto; a Skill do Claude Code é o "como" técnico atualizado da ferramenta.
3. **Execução sequencial estrita por fase** — ver `docs/roadmap.md`. Proibido avançar de fase sem cumprir 100% do DoD e do checklist da fase corrente.
4. **Atualização documental contínua** — ao concluir uma fase, atualizar `docs/` e `ai-context/` antes de pedir homologação.
5. **ADR para toda decisão de arquitetura** — nunca editar um ADR já homologado; decisões novas substituem as antigas via ADR subsequente (ver `docs/adr/`).
6. **Validação humana mandatória** ao fim de cada fase, antes do desbloqueio da fase seguinte.

## 3. Regra de dependência arquitetural

```
src/app  →  src/modules  →  src/lib
```

Sentido único. Proibido: dependência circular, inversão de chamada, módulos de domínio importando arquivos uns dos outros diretamente (comunicação só via `services`).

## 4. Não-negociáveis (violação = bloqueio de merge)

- Toda tabela tem `organization_id`, `id` (UUID v4), `created_at`, `updated_at`, `created_by`.
- Nenhuma tabela sem RLS habilitada e policy explícita no mesmo arquivo de migration.
- Nenhum texto hardcoded na UI — tudo via `next-intl` (pt-BR + en-US, sempre paritário).
- `strict: true` no TypeScript; `any` proibido.
- Nomenclatura técnica em inglês; texto de negócio nos catálogos de tradução.
- Fase 4 (camada de IA) só pode iniciar após o gate de segurança da Fase 4 estar auditado em produção (ver `docs/adr/ADR-001-classificacao-dados-e-rls.md`).

## 5. Ordem de leitura para onboarding de uma nova sessão de IA

1. Este arquivo (`ai-context/AGENTS.md`)
2. `ai-context/conventions.md`
3. `ai-context/domain-glossary.md`
4. `docs/roadmap.md` (status real da fase corrente)
5. `docs/adr/` (todas as decisões vigentes, em ordem numérica)
6. O playbook de skill específico da tarefa em `ai-context/skills/`
7. A especificação do módulo em `docs/specs/` (se existir)

## 6. Status atual

Projeto em **Fase 0 (Fundação)** — ainda não iniciada tecnicamente. Este commit estabelece apenas o andaime documental e de contexto, já incorporando 3 decisões tomadas na sessão de planejamento inicial (ver ADR-003, ADR-004 e ADR-005): acesso mobile via PWA, `deals` como entidade própria, e conformidade LGPD. Ver `docs/roadmap.md` para o estado vivo.
