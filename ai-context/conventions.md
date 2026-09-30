# Convenções do Projeto

Checagem obrigatória antes de qualquer atividade de código (ver `ai-context/AGENTS.md`, item 2).

## Consulta de documentação (Context7)

Antes de usar uma API de biblioteca externa (Next.js, Supabase, Tailwind, shadcn/ui, TanStack Query, next-intl, Vercel AI SDK etc.), consultar documentação atual via CLI `ctx7` em vez de confiar apenas em conhecimento de treinamento — frameworks evoluem rápido e a versão memorizada pode estar desatualizada.

```bash
ctx7 library "Next.js" "App Router middleware"   # resolve o library ID
ctx7 docs /vercel/next.js "App Router middleware" # consulta a doc pelo ID
```

Cada playbook em `ai-context/skills/` indica, em Pré-condições, para qual biblioteca essa consulta é mais relevante naquela etapa.

## Código

- TypeScript em modo `strict: true` permanente. `any` proibido — usar tipos gerados do Supabase ou `unknown` devidamente tratado.
- ESLint + Prettier automatizados na esteira de CI; falha bloqueia merge.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- Componentes de UI compactos, previsíveis, livres de efeitos colaterais de escopo.
- **Nomenclatura técnica sempre em inglês** (arquivos, variáveis, funções, classes, migrations). **Texto de negócio, rótulos, dados dinâmicos e mensagens de erro ao usuário** vêm do catálogo de tradução (pt-BR / en-US) — nunca hardcoded.

## Banco de dados

- Migrations SQL sequenciais, numeradas, **imutáveis** — nunca alterar uma migration já mesclada na branch principal.
- **RLS-first**: nenhuma tabela é criada sem suas policies de Row Level Security no mesmo arquivo de migration. Tabela sem policy explícita bloqueia o deploy.
- Tipagem TypeScript regerada automaticamente via Supabase CLI a cada migração estrutural.
- Isolamento de segurança acontece no Postgres (RLS), nunca delegado à interface.
- Toda tabela contém: `id` (UUID v4), `organization_id`, `created_at`, `updated_at`, `created_by` (ver Anexo B do documento normativo).
- Necessidade de novo atributo por tipo de associado → usar `custom_fields` / `custom_field_values` antes de cogitar nova migration relacional.

## Interface

Antes de compor uma tela nova ou instalar um componente, consultar a skill local `shadcn` (`.claude/skills/shadcn/SKILL.md`, instalada via `skills add shadcn/ui` a partir do próprio repositório oficial) — cobre composição, variantes, cores semânticas e regras de estilo/formulários/chat. Há também `migrate-radix-to-base` para o caso raro de um componente antigo baseado em Radix precisar migrar para Base UI (nosso padrão, ver `components.json`).

- Tokens de cor, tipografia, espaçamento e raio de borda centralizados em `src/styles/` (Tailwind).
- Todo componente com I/O assíncrono implementa os três estados: loading (skeleton), erro (tratamento gracioso), vazio (empty state explicativo).
- Badges seguem vocabulário fixo: Tier (A prioritário / B intermediário / C monitoramento), status de relacionamento (ativo-aquecido / esfriando), criticidade de prazo (no prazo / a vencer em 48h / atrasado).
- WCAG AA de contraste, navegação por teclado completa, ARIA em elementos interativos.
- Primitivos `shadcn/ui` em `src/components/ui/` — **não editar manualmente** (gerados via CLI). Compostos com regra de negócio vivem em `src/components/shared/`, nunca em `ui/`.
- Componentes instalados de **registries de terceiros do shadcn** (ex.: `@reui`, via `shadcn add @registry/nome`) vivem em `src/components/<registry>/` (ex.: `src/components/reui/`) e são tratados como código vendorizado: **não editar manualmente** e **isentos do lint do projeto** (ver `globalIgnores` em `eslint.config.mjs`) — não faz sentido corrigir à mão erros de hooks em milhares de linhas de código que não escrevemos. Ao adicionar um novo registry de terceiros, registrar o alias em `components.json` e adicionar a pasta correspondente ao `globalIgnores`.

## Git e entrega

- Branches: `feature/nome-da-feature`, `fix/nome-do-bug`.
- PRs pequenos, focados, com descrição e checklist de validação técnica marcado.
- Esteira bloqueante no CI: type-check, lint, testes de RLS.
- Tag semântica (`vX.Y.Z`) ao final de cada fase homologada.

## Documentação viva

- Nenhum módulo em `src/modules/` é codificado sem especificação prévia em `docs/specs/`.
- Toda decisão estrutural (segurança, bibliotecas, modelo de acesso, rede) exige ADR dedicado e imutável — nunca editar ADR homologado, criar um novo que aponte e substitua.
- `ai-context/AGENTS.md` e o playbook de skill aplicável são revisados ao fim de cada entrega.
- `ai-context/domain-glossary.md` é enriquecido conforme novos domínios são mapeados.
- `docs/roadmap.md` reflete o progresso real das branches de produção — nunca um progresso aspiracional.

## Segurança contínua

- Segredos só via variáveis de ambiente do provedor de hospedagem — nunca versionados no Git (ver `.env.example`).
- Toda migration passa por auditoria manual + automatizada de isolamento entre os 4 níveis de classificação.
- Leitura de registros `RESTRICTED` gera log assíncrono imutável em `audit_log`.
- Alteração na camada de permissões exige teste negativo prévio (retorno vazio/erro sem grant válido) antes do merge.

## Escalabilidade

- Nova área de negócio = novo módulo em `src/modules/`, replicando `components/ services/ schemas/ types.ts`. Proibido misturar domínios dentro de um módulo existente.
- Monólito modular mantido até que métricas objetivas de carga ou contenção de equipe justifiquem extração de um domínio para serviço independente (revisão trimestral).
