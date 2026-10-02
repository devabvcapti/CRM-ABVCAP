# Skill: scaffolding-setup

## Objetivo
Inicializar a fundação técnica do projeto — Next.js (App Router) + TypeScript estrito + Tailwind CSS + Supabase + Vercel — com ESLint, CI e variáveis de ambiente configurados, prevenindo retrabalho arquitetural destrutivo (decisões de setup têm alto custo de reversão).

## Pré-condições
- Documento normativo lido (`ARQUITERURA/...docx`) e `ai-context/AGENTS.md` assimilado.
- Conta/projeto Vercel e projeto Supabase disponíveis (ou a criar nesta fase).
- Nenhuma migration ou código de módulo ainda existente.
- **Skills do Claude Code a invocar**: `vercel:bootstrap`, `vercel:nextjs`, `vercel:vercel-cli`, `shadcn`.
- **Documentação via Context7**: `ctx7 library "Next.js" "..."` / `ctx7 library "Tailwind CSS" "..."` para configuração de App Router, ESLint e setup inicial (ver `ai-context/conventions.md`).

## Implementado em 2026-10-01 — PWA (ADR-003), ver antes de mexer de novo
- Service worker via `@serwist/turbopack` (não `@serwist/next`/`next-pwa` — aqueles usam o compilador webpack, este projeto builda com Turbopack). Pacotes: `@serwist/turbopack`, `serwist`, `esbuild` (devDependencies).
- `next.config.ts` envolvido com `withSerwist(withNextIntl(nextConfig))` — compõe com o plugin do next-intl, não substitui.
- `src/app/sw.ts`: worker source, usa `defaultCache` de `@serwist/turbopack/worker` (cache mínima de app shell, nenhuma rota de API/dados cacheada — por ora é só isso que o ADR-003 pede). **Excluído do `tsconfig.json` raiz** (`exclude`) porque usa o lib `webworker`, incompatível com o `lib: ["dom", ...]` do resto do projeto — tem um `tsconfig.worker.json` próprio só para checagem manual/IDE.
- Rota que serve o worker compilado **precisa ser um segmento dinâmico `src/app/serwist/[path]/route.ts`** (não um literal `sw.js/route.ts` — o tipo de `createSerwistRoute` exige `params: Promise<{ path: string }>`, e ele serve `/serwist/sw.js` *e* `/serwist/sw.js.map` sob o mesmo handler). Errar isso quebra o build (`next build` falha no type-check da rota).
- `SerwistProvider` (de `@serwist/turbopack/react`) envolve o `<body>` em `src/app/[locale]/layout.tsx`, com `swUrl="/serwist/sw.js"`.
- `src/app/manifest.ts` (convenção de arquivo do Next, raiz de `app/`, fora de `[locale]`) gera `/manifest.webmanifest` automaticamente — não setar `metadata.manifest` manualmente no layout, duplicaria a tag.
- Ícones em `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (+ `apple-icon.png`, `favicon.ico`) gerados a partir do logo oficial branco (`Design System/logos/ABVCAP BRANCO FUNDO TRANSPARENTE (3).png`) sobre o azul da marca `#112468` — nunca usar um ícone placeholder/genérico quando o asset de marca real existe.
- Verificado via Playwright: service worker chega a `activated`, manifest linkado corretamente, sem erros de página.

## Incidente real (2026-10-02) — toda env var nova precisa ir pro Vercel também
Adicionar uma env var só em `.env.local`/`.env.example` **não é suficiente**: derrubou a produção inteira (500 em toda rota) porque `src/proxy.ts` chama o Supabase em todo request, e as env vars nunca tinham sido criadas nas Environment Variables do projeto Vercel (`vercel env ls production` mostrava zero vars configuradas). Toda vez que uma env var nova for introduzida: `vercel env add <NOME> production` (e `preview`/`development`) **no mesmo passo** em que ela é adicionada ao `.env.local`, nunca como tarefa separada depois. Detalhe: a CLI recusa `NEXT_PUBLIC_*` que "parece credencial" (como a anon key) sem `--type config` explícito — isso é esperado e correto para a anon key (pública por design, protegida por RLS, não por sigilo), não usar `--type secret` nesse caso. Depois de adicionar env var em produção, **sempre redeployar** (`vercel --prod`) — `NEXT_PUBLIC_*` é embutido em build-time, não pega efeito em um build já existente. Ver `docs/roadmap.md` → "Incidente — 500 em produção" para o relato completo.

## Passos
1. `npx create-next-app@latest` com App Router, TypeScript, Tailwind, ESLint — `strict: true` no `tsconfig.json`.
2. Instalar e inicializar `shadcn/ui`.
3. Instalar `@supabase/supabase-js`, `@supabase/ssr`; criar clients em `src/lib/supabase/` (server, browser, admin — admin nunca exposto ao bundle do cliente), todos instanciados com `db: { schema: 'crm_abvcap' }` (ver ADR-006 — o projeto Supabase é compartilhado com outra aplicação da ABVCAP, nunca usar o `public` implícito).
4. Inicializar projeto Supabase (CLI) e pasta `supabase/migrations/`. Adicionar `crm_abvcap` em Project Settings → API → Exposed schemas.
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
