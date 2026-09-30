# ADR-003: Acesso Mobile via PWA Instalável

- **Status**: Aceito
- **Data**: 2026-09-29
- **Origem**: requisito explícito do dono do projeto ("fácil acesso via celular"), não coberto pelo documento normativo original.

## Contexto

O documento normativo especifica Next.js + Tailwind/shadcn responsivo, mas não define uma estratégia de acesso mobile além de "responsivo". A equipe de 5–30 usuários (GPs, executivos, equipe da associação) frequentemente opera fora do escritório — reuniões, eventos, assembleias — cenário em que o acesso pelo celular é rotina, não exceção.

## Decisão

O CRM nasce como **Progressive Web App (PWA) instalável**, não apenas um site responsivo:

- `manifest.json` com ícones, tema e `display: standalone`, permitindo instalação na tela inicial (Android e iOS/Safari).
- Service worker com estratégia de cache mínima (app shell) — sem exigir suporte offline completo de dados na v1, mas garantindo carregamento resiliente em conexão instável.
- **Web Push** como canal adicional de notificação, integrado ao mesmo mecanismo de `notification_preferences` já previsto na Fase 2 (in-app + e-mail + push).
- Padrão de navegação mobile dedicado: navegação inferior (bottom nav) ou menu retrátil no lugar da sidebar de desktop abaixo de um breakpoint definido — não apenas encolher o layout desktop.
- Área de toque mínima de 44×44px e testes E2E cobrindo viewport mobile (já refletido em `ai-context/skills/04-ui-design-system.md` e `08-testing-quality.md`).

Native app (iOS/Android via loja) fica fora de escopo da v1 — reavaliar apenas se a adoção via PWA se mostrar insuficiente.

## Consequências

- Fase 0 passa a incluir o `manifest.json` e o service worker básico como entregável (adicionar ao DoD da Fase 0).
- Fase 2 (notificações) ganha o canal de web push como terceiro canal, ao lado de in-app e e-mail — aumenta o escopo da skill `06-tasks-kanban-notifications`.
- A skill `04-ui-design-system` passa a exigir explicitamente um padrão de navegação mobile próprio, não uma adaptação do layout desktop.
- Sem custo de infraestrutura adicional: PWA reaproveita o mesmo deploy Next.js/Vercel, sem loja de aplicativos, sem processo de aprovação externo.
