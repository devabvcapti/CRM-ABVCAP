# Roadmap — CRM ABVCAP

Fonte da verdade do progresso real. Atualizar ao final de cada fase (ver `ai-context/skills/10-documentation-context.md`). Nunca deixar este arquivo divergir do estado real das branches de produção.

Baseado no Anexo D do documento normativo (`ARQUITERURA/`).

## Deploy

- **Produção**: https://crm-abvcap.vercel.app — projeto Vercel `devabvcaptis-projects/crm-abvcap`, conectado ao GitHub (`devabvcapti/CRM-ABVCAP`). Todo push em `master` gera deploy automático de produção.
- Deployment Protection (Vercel Authentication) está **ativa** — só quem tem conta no time Vercel abre o link direto. Para apresentar a colaboradores sem conta Vercel, existe um secret de "Protection Bypass" gerado em 2026-10-01 (não versionado aqui por segurança — pedir o link completo a quem administra o projeto). Formato: `https://crm-abvcap.vercel.app/?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`.
- Reavaliar quando o app tiver dados reais: manter Deployment Protection ativa é a postura correta dado o ADR-001 (classificação de dados), mesmo após abrirmos para mais colaboradores.

| Fase | Prazo sugerido | Status | Entregas principais |
|---|---|---|---|
| **Fase 0 — Fundação** | Semanas 1–4 | 🟡 Em andamento | Next.js + TS estrito ✅; Tailwind v4 ✅; shadcn/ui (Base UI + Nova) ✅; **i18n (next-intl, pt-BR/en-US) ✅**; **Supabase + migration inicial (`crm_abvcap`) ✅**; **RLS ativa (`user_profiles`/`entity_access_grants`/`audit_log`) ✅**; `entity_access_grants` + `organization_id` em todas as tabelas ✅ (demais entidades na Fase 1); **manifest.json + service worker (PWA)** 🔲; CI/CD 🔲 |
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
- ✅ Schema dedicado `crm_abvcap` + autenticação compartilhada (2026-10-01): o projeto Supabase do CRM vai hospedar também outra aplicação da ABVCAP. Nenhuma tabela do CRM vive em `public`; `auth.users` é compartilhado, permissionamento resolvido via `crm_abvcap.user_profiles` — ver `docs/adr/ADR-006-schema-dedicado-e-autenticacao-compartilhada.md`.

## Decisões em aberto

_(nenhuma pendência crítica no momento — revisar ao avançar para a Fase 0 técnica)_

## Backlog / adiado

- **`deals` / `deal_participants`** (2026-09-30): entidade e especificação já desenhadas (`docs/adr/ADR-004-deals-entidade-propria.md`, `docs/specs/deals.md`), mas o dono do projeto confirmou que não são necessárias neste momento. Retirada da Fase 1. O ADR permanece válido para quando a implementação for retomada — não requer novo ADR, apenas atualizar o status em `docs/specs/deals.md` e reinserir no roadmap na fase que fizer sentido então.

## Escopo removido

- **Eventos** (`events`/`event_participants`, rota `/eventos`) (2026-09-30): removido do escopo do projeto por decisão do dono do projeto. Isso é um desvio deliberado da Seção 1.2 e do Anexo B do documento normativo original, que listavam "organização integral de reuniões e eventos" como parte da v1 — registrado aqui para que a divergência entre o docx e o estado vivo do projeto não seja confundida com omissão. Diferente do backlog acima: não há intenção declarada de retomar; se isso mudar no futuro, tratar como feature nova (nova spec/ADR), não como retomada de um design existente.

## Log de fases concluídas

_(nenhuma fase concluída ainda)_

## Log de progresso — Fase 0

- **2026-09-29**: scaffolding inicial via `create-next-app` (Next.js 16.3.6, App Router, TypeScript estrito, Tailwind v4, pnpm) + `shadcn/ui` inicializado (Base UI + preset Nova) com o componente `alert` instalado. Lint e build de produção validados. Ainda faltam: Supabase/migrations, RLS, i18n, PWA, CI/CD — ver tabela acima.
- **2026-09-30**: repositório publicado em [github.com/devabvcapti/CRM-ABVCAP](https://github.com/devabvcapti/CRM-ABVCAP) (`origin`/`master`, tudo commitado e pushado até este ponto). Biblioteca de componentes UI bastante ampliada:
  - **41 primitivos `src/components/ui/`** (shadcn/ui, Base UI + preset Nova): alert, attachment, avatar, badge, breadcrumb, bubble, button, calendar, card, checkbox, combobox, context-menu, dropdown-menu, empty, field, input, input-group, item, kbd, label, message, message-scroller, navigation-menu, pagination, popover, progress, questionnaire, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, spinner, table, tabs, textarea, toast, toggle, toggle-group, tooltip.
  - **Registry de terceiros `@reui`** (`src/components/reui/`): `badge`, `frame`, `kanban.tsx` (candidato direto para a Fase 2), `sortable.tsx`, `data-grid/` completo (filtro/visibilidade de coluna, seleção de células, paginação, virtualização, drag-and-drop), `gantt/` completo. Isento do lint do projeto (código vendorizado) — ver `ai-context/conventions.md`.
  - **Registry de terceiros `@bklit`** (`src/components/charts/`, 48 arquivos): heatmap, pie e sunburst charts (visx + d3). Também isento do lint.
  - **42 arquivos de exemplo** em `src/components/examples/` documentando o uso de cada padrão acima.
  - `next-themes` (dark mode), `@shadcn/helpers` + `@shadcn/react` (glue para IA/chat, inertes até a Fase 4), skills locais `shadcn` e `migrate-radix-to-base` instaladas em `.claude/skills/`.
  - Correções aplicadas ao longo do caminho: lint de `use-mobile.ts` (setState direto em efeito), import relativo quebrado em `chart-loading-label.tsx`, `@types/d3-shape` faltante, substituição de `sonner` por `toast` nativo em dois exemplos (Base UI, não Radix).
  - Clonado `atomic-crm/` (marmelab, commit `a863e2a0`) como referência de arquitetura (gitignored, nunca faz parte do código) — análise crítica registrada na conversa: framework diferente (Vite/react-admin, não Next.js), `deals` lá é funil de vendas (não usar como modelo), RLS muito mais permissivo que o nosso ADR-001 exige. Vale aproveitar: schema-as-code (`supabase/schemas/*.sql`), activity log via view, importador de CSV.
  - Mockup estrutural completo publicado como Artifact (fora do repo): sidebar com Dashboard/Contatos/Empresas/Kanban funcionais (dados mock, tema claro/escuro, gaveta mobile), demais itens como placeholder. Contatos usa badges de "Cargo" institucional (Representante/Palestrante/Conselheira) no lugar de Tier; Empresas permite buscar e ver todos os contatos vinculados a uma organização.
  - Decisões de escopo: `deals` adiado (backlog), `Eventos` removido do escopo (ver seções acima).
  - **Ainda não iniciado**: nenhum código Next.js real de tela/rota (`src/app/[locale]/...`), Supabase/migrations, RLS, i18n (next-intl), PWA, CI/CD. O mockup é só referência visual, não código de produção.
- **2026-10-01**: deploy de produção publicado no Vercel, conectado ao GitHub (ver seção Deploy acima). Primeira tela real criada: **i18n (`next-intl` 4.14.8) implementado de ponta a ponta**, seguindo a convenção atual do Next.js 16 (`src/proxy.ts`, não `middleware.ts` — renomeado nesta versão) e o padrão mais recente do next-intl (`next/root-params` em vez do `requestLocale`/`setRequestLocale`, marcado como legado na doc oficial). `src/app/page.tsx`/`layout.tsx` movidos para `src/app/[locale]/` (agora o segmento raiz); catálogos `src/messages/pt-BR.json` e `en-US.json` criados; `/` redireciona para `/pt-BR` via proxy; verificado via Playwright que `/pt-BR` e `/en-US` renderizam o conteúdo certo. Identidade visual (Montserrat + cores oficiais) preservada na migração.
- **2026-10-01 (cont.)**: Supabase conectado — CLI instalado localmente (`pnpm add -D supabase`, Windows não tem binário global), projeto linkado via `SUPABASE_ACCESS_TOKEN` (Personal Access Token do dono do projeto, nunca gravado em arquivo) a `csfrlgrtedtbjwieozrp`. Migration fundacional `supabase/migrations/0001_crm_init.sql` aplicada via `supabase db push`: cria o schema `crm_abvcap` (ADR-006) e as três tabelas de Fase 0 do Anexo B — `user_profiles` (perfil de operador + papel + `capabilities` jsonb), `entity_access_grants` (controle de acesso excepcional CONFIDENTIAL/RESTRICTED) e `audit_log` (log imutável — sem policy de UPDATE/DELETE, só `service_role` contorna). RLS habilitada e com policies default-deny nas três (helpers `crm_abvcap.current_profile_id()`/`has_role()` em `SECURITY DEFINER` evitam recursão). `organization_id` (chave de tenant adormecida, ADR-002) presente nas três com um UUID fixo de tenant único por enquanto. Tipos gerados em `src/types/database.ts` (`supabase gen types typescript --linked --schema crm_abvcap`). Clients criados em `src/lib/supabase/{browser,server,admin}.ts` + `src/lib/supabase/proxy.ts`, todos com `db: { schema: 'crm_abvcap' }` explícito (nunca o `public` implícito); `admin.ts` protegido com o pacote `server-only`. `src/proxy.ts` agora compõe next-intl (decide locale primeiro) com a renovação de sessão do Supabase (`updateSession`, escreve cookies na mesma response, nunca substitui o redirect/rewrite de locale) — convenção `getAll`/`setAll` (não o `get`/`set`/`remove` depreciado) confirmada via Context7 (`/supabase/ssr`). Build e lint verificados limpos. **Nota para quando houver UI de auth**: o client público ainda usa a `anon key` legada (formato JWT) por ser o que já está em `.env.example`; Supabase está depreciando esse formato a favor de `sb_publishable_`/`sb_secret_` até o fim de 2026 (ambos coexistem até lá) — reavaliar a troca quando a Fase 1 criar o fluxo de login. Schema `crm_abvcap` já exposto via API (ADR-006 item 3) — aplicado via Management API (`PATCH /v1/projects/{ref}/postgrest`, `db_schema` agora inclui `crm_abvcap` além de `public,graphql_public`), não precisou do dashboard. Faltava ainda o pré-requisito de GRANT em nível Postgres (expor o schema não basta — sem `GRANT USAGE`/`GRANT ALL ON TABLES` para `anon`/`authenticated`/`service_role`, toda query via API falha com `42501 permission denied for schema`, antes mesmo de avaliar RLS): corrigido em `supabase/migrations/0002_crm_grants.sql`. Verificado via `curl` direto no REST (`Accept-Profile: crm_abvcap`) com a anon key: `user_profiles` retorna `[]` (vazio, não erro) — exatamente o default-deny esperado para um papel sem policy de `select` (policies são só `to authenticated`).
