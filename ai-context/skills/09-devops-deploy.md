# Skill: devops-deploy

## Objetivo
Gerenciar pipelines de CI, ambientes de staging/produção, observabilidade e rotinas de backup, garantindo deploys determinísticos e reversíveis a qualquer momento.

## Pré-condições
- Repositório GitHub conectado à Vercel.
- Projeto Supabase provisionado.

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
