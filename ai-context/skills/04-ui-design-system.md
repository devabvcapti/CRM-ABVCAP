# Skill: ui-design-system

## Objetivo
Construir componentes via `shadcn/ui` e Tailwind — entity cards, badges semânticas, timeline e quadros Kanban — com padronização visual e reuso, eliminando duplicidade de código de interface. Inclui a responsabilidade de acesso fácil via celular como **PWA instalável** (ver `docs/adr/ADR-003-acesso-mobile-pwa.md`).

## Pré-condições
- Skill 01 concluída (`shadcn/ui` instalado).
- Tokens de design centralizados em `src/styles/`.
- Especificação funcional do módulo aprovada em `docs/specs/`.

## Passos
1. Gerar primitivos via CLI do `shadcn/ui` em `src/components/ui/` — nunca editar manualmente.
2. Construir compostos com regra de negócio em `src/components/shared/` (`entity-card/`, `badge/`, `timeline/`, `kanban/`), recebendo dados **unicamente via props**.
3. Implementar os três estados obrigatórios em todo componente assíncrono: loading (skeleton), erro, vazio.
4. Validar em viewport mobile (largura mínima ~360px) e desktop antes de considerar o componente pronto — não apenas desktop.
5. Validar contraste WCAG AA, navegação por teclado e ARIA.
6. Abaixo do breakpoint mobile, usar navegação inferior (bottom nav) ou menu retrátil dedicado — nunca apenas encolher a sidebar de desktop (ADR-003).

## Padrões obrigatórios
- Cores, tipografia, espaçamento, raio de borda: só via variáveis Tailwind de `src/styles/` — proibido valor mágico inline.
- Badges seguem vocabulário fixo (Tier A/B/C; ativo-aquecido/esfriando; no prazo/a vencer em 48h/atrasado) — não inventar novas variações sem atualizar `ai-context/domain-glossary.md`.
- Área de toque mínima de 44×44px em elementos interativos (requisito de uso mobile).
- Layout responsivo obrigatório: nenhum componente pode depender de largura fixa de desktop para ser utilizável.

## Checklist de aceite
- [ ] Componente renderiza corretamente em mobile e desktop.
- [ ] Três estados (loading/erro/vazio) implementados e testados.
- [ ] Contraste AA e navegação por teclado validados.
- [ ] Nenhuma lógica de negócio dentro de `src/components/ui/`.
- [ ] Reuso comprovado (componente usado por mais de um módulo, quando aplicável).
