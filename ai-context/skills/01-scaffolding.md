# Skill: scaffolding-setup

## Objetivo
Inicializar a fundação técnica do projeto — Next.js (App Router) + TypeScript estrito + Tailwind CSS + Supabase + Vercel — com ESLint, CI e variáveis de ambiente configurados, prevenindo retrabalho arquitetural destrutivo (decisões de setup têm alto custo de reversão).

## Pré-condições
- Documento normativo lido (`ARQUITERURA/...docx`) e `ai-context/AGENTS.md` assimilado.
- Conta/projeto Vercel e projeto Supabase disponíveis (ou a criar nesta fase).
- Nenhuma migration ou código de módulo ainda existente.
- **Skills do Claude Code a invocar**: `vercel:bootstrap`, `vercel:nextjs`, `vercel:vercel-cli`, `shadcn`.
- **Documentação via Context7**: `ctx7 library "Next.js" "..."` / `ctx7 library "Tailwind CSS" "..."` para configuração de App Router, ESLint e setup inicial (ver `ai-context/conventions.md`).

## Passos
1. `npx create-next-app@latest` com App Router, TypeScript, Tailwind, ESLint — `strict: true` no `tsconfig.json`.
2. Instalar e inicializar `shadcn/ui`.
3. Instalar `@supabase/supabase-js`, `@supabase/ssr`; criar clients em `src/lib/supabase/` (server, browser, admin — admin nunca exposto ao bundle do cliente).
4. Inicializar projeto Supabase (CLI) e pasta `supabase/migrations/`.
5. Configurar `next-intl` com rotas `[locale]` (pt-BR / en-US) — ver skill 05.
6. Criar `.env.example` com todas as chaves esperadas, sem valores reais.
7. Configurar ESLint + Prettier na esteira de CI (GitHub Actions) — ver skill 09.
8. Conectar repositório à Vercel (preview automático por PR).
9. Registrar os ADRs iniciais (stack, RLS-first, multi-tenant adormecido) em `docs/adr/`.

## Padrões obrigatórios
- `strict: true` permanente; `any` proibido.
- Nenhuma lógica de negócio em `src/app/` — apenas roteamento e orquestração de página.
- Regra de dependência: `src/app → src/modules → src/lib` (unidirecional).
- Nenhum segredo no repositório — apenas em `.env.example` (sem valores) e nas variáveis de ambiente do provedor.
- Toda decisão de setup relevante gera um ADR antes do fim da Fase 0.

## Checklist de aceite
- [ ] `npm run build` e `npm run lint` passam sem erros.
- [ ] CI do GitHub Actions executa em cada PR e bloqueia merge em falha.
- [ ] Deploy preview na Vercel funcional a partir de um PR de teste.
- [ ] `.env.example` cobre 100% das variáveis usadas no código.
- [ ] ADRs iniciais registrados e referenciados em `docs/roadmap.md`.
