# Skill: ui-design-system

## Objetivo
Construir componentes via `shadcn/ui` e Tailwind — entity cards, badges semânticas, timeline e quadros Kanban — com padronização visual e reuso, eliminando duplicidade de código de interface. Inclui a responsabilidade de acesso fácil via celular como **PWA instalável** (ver `docs/adr/ADR-003-acesso-mobile-pwa.md`).

## Pré-condições
- Skill 01 concluída (`shadcn/ui` instalado).
- Tokens de design centralizados em `src/styles/`.
- Especificação funcional do módulo aprovada em `docs/specs/`.
- **Skills do Claude Code a invocar**: `shadcn`, `frontend-design`, `design:design-system` (para consistência de tokens entre telas).
- **Documentação via Context7**: `ctx7 library "shadcn/ui" "..."` / `ctx7 library "Tailwind CSS" "..."` para props de componente e classes utilitárias atuais.

## Implementado em 2026-10-02 — padrão de tela de entidade + pegadinha do Select
- **Lista → Detalhe (página própria, `/recurso/[id]`) → Editar (painel, só a partir do detalhe)** é o padrão adotado para telas de entidade, não Lista → Editar direto. Decisão veio de comparar com o `atomic-crm` (clone de referência) depois do dono do projeto achar o fluxo ruim na primeira versão (Lista + painel genérico com todos os campos). Aplicado em Contatos (`src/app/[locale]/(app)/contacts/[id]/page.tsx`) e depois em Organizações (`src/app/[locale]/(app)/organizations/[id]/page.tsx`) — ver `docs/roadmap.md` (2026-10-02) para o relato completo das duas. Timeline de interações é um componente de verdade compartilhado entre as duas (`src/components/shared/interactions-timeline.tsx` — primeiro uso real dessa pasta), porque os campos são idênticos entre entidades, só muda o `participant_type`; já o vínculo organização↔contato é replicado (não compartilhado) entre `contacts/organization-links.tsx` e `organizations/contact-links.tsx`, porque ali os campos/labels do form realmente mudam conforme qual lado é fixo vs. selecionável — critério: só vira `src/components/shared/` o que é idêntico de verdade entre entidades, não "parecido".
- Página de Detalhe: header (avatar/iniciais + nome + badges): duas colunas — conteúdo principal (timeline de interações, quando a entidade participa de `interactions`) + barra lateral (campos estruturados, dado relacionado como vínculos, ações de editar/excluir). Dado relacionado (vínculos, tags) fica na barra lateral, **fora** do formulário principal de editar — só o formulário de editar abre um painel.
- **Pegadinha real do `Select` (Base UI)**: `SelectValue` sem `children` mostra o **valor bruto armazenado** no trigger fechado, não o rótulo do `SelectItem` correspondente — só funciona por coincidência quando valor e rótulo são a mesma string (ex.: tier "A"/"B"/"C"). Todo `Select` com `defaultValue` vindo do banco (status, tipo, classificação etc.) precisa de `<SelectValue>{(value) => value ? t(...) : t("selectPlaceholder")}</SelectValue>` — sem isso, a tela mostra a chave interna (`"internal"`, `"ativo"`) em vez do texto traduzido. Achado teria passado despercebido sem testar a tela de verdade com um valor pré-selecionado (os primeiros testes E2E sempre selecionavam explicitamente, nunca checavam o valor default). **Importante**: a pegadinha não é exclusiva de `defaultValue` — um `Select` sem `defaultValue` também pode mostrar o valor bruto ao selecionar um item interativamente (achado num `Select` de uuid em `contact-links.tsx`). Regra prática: todo `Select` sem `children` função precisa do fix, **exceto** quando valor e rótulo são garantidamente a mesma string (ex.: `tier`).
- **Pegadinha de automação (não de produto) em E2E mobile**: um clique Playwright normal (`.click()`) pode travar indefinidamente num botão genuinamente clicável, bem perto do fim de uma página alta, especificamente no projeto `mobile-chromium` ("FieldGroup intercepts pointer events" pra sempre) — artefato do hit-test sintético via CDP sob emulação de viewport, não reproduz em `chromium` (desktop) nem afeta usuário real. Verificar antes de assumir bug de produto: `document.elementFromPoint` nas mesmas coordenadas (via `page.evaluate`) deve confirmar o botão como alvo, retângulo estável (`getBoundingClientRect` igual em duas medições) e zero `MutationObserver` no período. Se confirmado, contornar só ali com `locator.evaluate(el => el.click())` (despacha direto no elemento, sem depender da coordenada sintética) — ver `e2e/organization-contact-links.spec.ts`.

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
