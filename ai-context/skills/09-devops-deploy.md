# Skill: devops-deploy

## Objetivo
Gerenciar pipelines de CI, ambientes de staging/produção, observabilidade e rotinas de backup, garantindo deploys determinísticos e reversíveis a qualquer momento.

## Pré-condições
- Repositório GitHub conectado à Vercel.
- Projeto Supabase provisionado.
- **Skills do Claude Code a invocar**: `vercel:deploy`, `vercel:deployments-cicd`, `vercel:env`, `vercel:vercel-cli`, `vercel:status`.
- **Documentação via Context7**: `ctx7 library "GitHub Actions" "..."` para sintaxe de workflow; `ctx7 library "Sentry" "Next.js"` para instrumentação de observabilidade.

## Implementado em 2026-10-01 — escopo parcial (gate de Fase 0), ver antes de mexer de novo
- `.github/workflows/ci.yml`: roda em todo push/PR para `master` — `pnpm/setup@v1` (substitui o par `pnpm/action-setup` + `actions/setup-node`; `version` omitido porque `package.json` já declara `packageManager: pnpm@12.3.4`, ≥ v11 exigido pela action) com `runtime: node@24` (mesma versão do Vercel e do ambiente local) → `pnpm install --frozen-lockfile` → `pnpm run lint` → `pnpm run type-check` → `pnpm run build`.
- **Pegadinha real já encontrada**: `tsc --noEmit` sozinho, num checkout limpo (sem `.next/` gerado antes), falha com `Cannot find name 'LayoutProps'` — esse tipo (e `PageProps`/`LayoutProps` em geral) é gerado pelo próprio Next.js em `.next/types/`, só existe depois de rodar `next dev`/`next build`/`next typegen` pelo menos uma vez. Por isso o script `type-check` é `next typegen && tsc --noEmit`, nunca só `tsc --noEmit` — `next typegen` gera as declarações sem precisar de build completo. Isso foi pego porque o CI roda num checkout novo a cada vez (sem `.next/` residual do ambiente local), reproduzido localmente apagando `.next/` antes de testar.
- Confirmado que `pnpm run build` passa **sem nenhuma env var do Supabase definida** (nada no código hoje chama os clients em build-time/SSG) — por isso o workflow não declara `secrets.*` ainda. Quando alguma página passar a buscar dados do Supabase em build/SSG, adicionar os secrets correspondentes no repositório GitHub (Settings → Secrets) e injetá-los no step de build.
- **Fora do escopo desta entrega** (itens do checklist abaixo que pertencem a fases futuras, não ao gate mínimo de Fase 0): testes unitários/RLS no CI (ainda não existem testes — `supabase/tests/` é só criado a partir da Fase 1, skill 02/03), Sentry, rotina de backup, tag semântica por fase. Não marcar o checklist completo por causa disso — é sinalizado aqui para não ser confundido com omissão.
- Branch protection exigindo o check `ci` do GitHub Actions antes de merge (passo "bloqueia o merge" dos Passos abaixo) **ainda não foi ativado** — é uma mudança de configuração do repositório (não um arquivo versionado), pendente de confirmação explícita do dono do projeto antes de ligar.

## Passos
1. GitHub Actions: lint → type-check → testes unitários → testes de RLS → build. Qualquer falha bloqueia o merge.
2. Deploy preview automático por PR na Vercel; promoção a produção só após homologação humana da fase.
3. Configurar Sentry para rastreamento de erros em produção (front e server).
4. Configurar backups automáticos do Supabase e documentar RPO/RTO esperado em `docs/`.
5. Variáveis de ambiente geridas exclusivamente no provedor (Vercel/Supabase), nunca no repositório.
6. Tag semântica (`vX.Y.Z`) publicada ao final de cada fase homologada.

## Padrões obrigatórios
- Nenhum deploy de produção sem passar pela esteira completa de CI.
- Rollback deve ser possível a qualquer momento — evitar migrations não reversíveis sem plano de contingência documentado.
- Segredos rotacionáveis sem exigir novo deploy de código.

## Checklist de aceite
- [ ] Pipeline de CI bloqueante ativo e testado com um PR intencionalmente quebrado.
- [ ] Deploy preview funcional por PR.
- [ ] Sentry capturando erros em ambiente de staging.
- [ ] Rotina de backup documentada e testada (restauração validada ao menos uma vez).
