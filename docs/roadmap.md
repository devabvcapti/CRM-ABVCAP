# Roadmap — CRM ABVCAP

Fonte da verdade do progresso real. Atualizar ao final de cada fase (ver `ai-context/skills/10-documentation-context.md`). Nunca deixar este arquivo divergir do estado real das branches de produção.

Baseado no Anexo D do documento normativo (`ARQUITERURA/`).

| Fase | Prazo sugerido | Status | Entregas principais |
|---|---|---|---|
| **Fase 0 — Fundação** | Semanas 1–4 | 🟡 Em andamento | Next.js + TS estrito ✅; Tailwind v4 ✅; shadcn/ui (Base UI + Nova) ✅; Supabase + migrations iniciais 🔲; RLS ativa 🔲; `entity_access_grants` + `organization_id` em todas as tabelas 🔲; i18n scaffolding 🔲; **manifest.json + service worker (PWA)** 🔲; CI/CD 🔲 |
| **Fase 1 — Núcleo de Relacionamento** | Semanas 5–8 | 🔲 Não iniciada | CRUD contatos/organizações; `organization_contacts` com histórico; timeline de interações; busca + filtros salvos; tags; importador CSV/XLSX; processo de atendimento a titulares LGPD |
| **Fase 2 — Tarefas, Kanban e Notificações** | Semanas 9–11 | 🔲 Não iniciada | Tarefas com recorrência; Kanban com mutação otimista; notificações Realtime + Resend **+ Web Push**; Vercel Cron |
| **Fase 3 — Dashboards, Cards e Badges** | Semanas 12–14 | 🔲 Não iniciada | KPIs de engajamento; entity cards + badges semânticas; detecção de relacionamento esfriando; follow-up em lote |
| **Fase 4 — Camada de IA** *(gate de segurança)* | Trimestre 2 | 🔲 Não iniciada | Abstração de LLM; `pgvector`; resumo executivo; next-best-action; busca semântica; rascunho de follow-up |
| **Fase 5 — Integrações** | Trimestres 2–3 | 🔲 Não iniciada | OAuth Google Workspace/Microsoft 365; webhooks assinados; exportação estruturada; testes de reversibilidade |

## Critérios de pronto (DoD) por fase

Ver Anexo D do documento normativo para o DoD completo de cada fase, e Anexo E para o checklist item a item que a IA executora deve marcar antes de solicitar homologação.

## Decisões resolvidas (2026-09-29, na sessão de planejamento inicial)

- ✅ Acesso mobile: **PWA instalável** (manifest + service worker + web push) — ver `docs/adr/ADR-003-acesso-mobile-pwa.md`. Adiciona entregável à Fase 0 (manifest/service worker) e ao canal de notificações da Fase 2 (web push).
- ✅ `deals`/`mandatos`: modelo de entidade **desenhado** (não funil comercial) — ver `docs/adr/ADR-004-deals-entidade-propria.md`. Implementação **adiada** (ver Backlog abaixo, 2026-09-30): não é necessária no momento, retirada do escopo da Fase 1.
- ✅ Conformidade LGPD: ADR criado agora, na Fase 0 — ver `docs/adr/ADR-005-conformidade-lgpd.md`.

## Decisões em aberto

_(nenhuma pendência crítica no momento — revisar ao avançar para a Fase 0 técnica)_

## Backlog / adiado

- **`deals` / `deal_participants`** (2026-09-30): entidade e especificação já desenhadas (`docs/adr/ADR-004-deals-entidade-propria.md`, `docs/specs/deals.md`), mas o dono do projeto confirmou que não são necessárias neste momento. Retirada da Fase 1. O ADR permanece válido para quando a implementação for retomada — não requer novo ADR, apenas atualizar o status em `docs/specs/deals.md` e reinserir no roadmap na fase que fizer sentido então.

## Log de fases concluídas

_(nenhuma fase concluída ainda)_

## Log de progresso — Fase 0

- **2026-09-29**: scaffolding inicial via `create-next-app` (Next.js 16.3.6, App Router, TypeScript estrito, Tailwind v4, pnpm) + `shadcn/ui` inicializado (Base UI + preset Nova) com o componente `alert` instalado. Lint e build de produção validados. Ainda faltam: Supabase/migrations, RLS, i18n, PWA, CI/CD — ver tabela acima.
