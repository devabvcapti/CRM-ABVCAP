# Roadmap — CRM ABVCAP

Fonte da verdade do progresso real. Atualizar ao final de cada fase (ver `ai-context/skills/10-documentation-context.md`). Nunca deixar este arquivo divergir do estado real das branches de produção.

Baseado no Anexo D do documento normativo (`ARQUITERURA/`).

| Fase | Prazo sugerido | Status | Entregas principais |
|---|---|---|---|
| **Fase 0 — Fundação** | Semanas 1–4 | 🔲 Não iniciada | Next.js + TS estrito; Supabase + migrations iniciais; RLS ativa; `entity_access_grants` + `organization_id` em todas as tabelas; i18n scaffolding; CI/CD; ADRs iniciais |
| **Fase 1 — Núcleo de Relacionamento** | Semanas 5–8 | 🔲 Não iniciada | CRUD contatos/organizações; `organization_contacts` com histórico; timeline de interações; busca + filtros salvos; tags; importador CSV/XLSX |
| **Fase 2 — Tarefas, Kanban e Notificações** | Semanas 9–11 | 🔲 Não iniciada | Tarefas com recorrência; Kanban com mutação otimista; notificações Realtime + Resend; Vercel Cron |
| **Fase 3 — Dashboards, Cards e Badges** | Semanas 12–14 | 🔲 Não iniciada | KPIs de engajamento; entity cards + badges semânticas; detecção de relacionamento esfriando; follow-up em lote |
| **Fase 4 — Camada de IA** *(gate de segurança)* | Trimestre 2 | 🔲 Não iniciada | Abstração de LLM; `pgvector`; resumo executivo; next-best-action; busca semântica; rascunho de follow-up |
| **Fase 5 — Integrações** | Trimestres 2–3 | 🔲 Não iniciada | OAuth Google Workspace/Microsoft 365; webhooks assinados; exportação estruturada; testes de reversibilidade |

## Critérios de pronto (DoD) por fase

Ver Anexo D do documento normativo para o DoD completo de cada fase, e Anexo E para o checklist item a item que a IA executora deve marcar antes de solicitar homologação.

## Decisões em aberto (a resolver antes/durante a Fase 0)

- [ ] Estratégia de acesso mobile: PWA instalável (manifest + service worker + web push) vs. apenas web responsivo. Ver discussão em andamento.
- [ ] Conformidade LGPD explícita para dados pessoais de contatos (e-mails, telefones) — não coberta explicitamente no documento normativo.
- [ ] Confirmar se `deals`/`mandatos` precisam de tabela própria no Anexo B (hoje citados apenas como exemplo de classificação no Anexo C, sem tabela correspondente).

## Log de fases concluídas

_(vazio — projeto ainda não iniciou a Fase 0 tecnicamente)_
