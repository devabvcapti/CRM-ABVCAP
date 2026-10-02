# Glossário do Domínio — PE/VC e ABVCAP

Barreira contra desvio de nomenclatura no código. Enriquecer conforme novos domínios forem mapeados (nunca remover termos vigentes sem ADR).

## Papéis do ecossistema

- **GP (General Partner)** — gestor de um fundo de Private Equity ou Venture Capital; toma as decisões de investimento do fundo.
- **LP (Limited Partner)** — investidor institucional ou pessoa física que aporta capital em um fundo, sem gestão ativa.
- **Family Office** — estrutura de gestão patrimonial de uma família ou grupo de famílias, frequentemente atuando como LP.
- **Associado** — organização ou pessoa filiada à ABVCAP.

## Conceitos de negócio

- **Mandato** — mandato de investimento ou representação em andamento; dado sensível, tipicamente classificado como `CONFIDENTIAL` ou `RESTRICTED`.
- **Deal** — operação/transação em andamento (aquisição, rodada de investimento, M&A) do ecossistema PE/VC; dado `RESTRICTED` por padrão. Modelado como entidade própria (`deals` + `deal_participants`, ver ADR-004) — é **registro de inteligência institucional**, não funil de vendas: não possui estágios comerciais, metas de conversão ou métricas de ganho/perda (isso permanece fora de escopo da v1).
- **Tese setorial** — hipótese de investimento de um fundo para um setor específico; dado `CONFIDENTIAL`.
- **Tier de Relacionamento (A/B/C)** — classificação de prioridade institucional de uma organização (`organizations.tier`):
  - **Tier A** — destaque prioritário.
  - **Tier B** — intermediário.
  - **Tier C** — monitoramento.
- **Cargo (badge institucional de contato)** — ex.: Representante, Palestrante, Conselheiro. Decisão de 2026-09-30: substituiu Tier como o badge de status exibido para **contatos** (Tier continua existindo, mas só para `organizations`). Modelado como **tag comum** via `tags`/`entity_tags` (`entity_type = 'contact'`), não como coluna própria — reaproveita o mecanismo polimórfico de taxonomia do Anexo B em vez de duplicar estrutura.
- **Temperatura de contato** — indicador de "aquecimento" de um relacionamento com base na recência/frequência de interações; usado para identificar contatos entrando em resfriamento.
- **Memória institucional** — princípio central do produto: nenhum histórico de contato, tese ou vínculo se perde quando um executivo muda de função, fundo ou mandato (ver `organization_contacts` com `start_date`/`end_date`).

## Classificação de dados (ADR-001)

- **PUBLIC** — acesso total a usuários internos autenticados; uso livre pela IA.
- **INTERNAL** — acesso a todos os operadores autenticados; uso livre pela IA (resumos, indexação vetorial).
- **CONFIDENTIAL** — default-deny; requer grant ativo em `entity_access_grants`; IA só acessa se o solicitante tiver grant.
- **RESTRICTED** — default-deny estrito; grant obrigatório; toda leitura gera registro em `audit_log`; bloqueado por padrão para embeddings/prompts (opt-in explícito e logado).

## Entidades estruturais do schema

- **organization_contacts** — vínculo muitos-para-muitos entre `contacts` e `organizations`, com `role`, `start_date`, `end_date`. É a espinha dorsal da "memória institucional".
- **entity_access_grants** — concessão excepcional de acesso a uma entidade específica em nível `CONFIDENTIAL`/`RESTRICTED`, com usuário concedente e timestamp.
- **custom_fields / custom_field_values** — mecanismo de extensão de atributos sem nova migration relacional.
- **organization_id** — chave de tenant presente em toda tabela (arquitetura multi-tenant adormecida — ver ADR-002). **Não confundir com a entidade de negócio `organizations`** (fundos/investidores/family offices etc.): toda FK para `organizations.id` usa o nome **`org_id`** (ex.: `organization_contacts.org_id`), nunca `organization_id` — esse nome já está reservado para o tenant em toda tabela.

## Papéis internos de usuário (`user_profiles.role`)

- **Admin** — acesso e configuração plena.
- **Gestor** — gestão operacional, sem configurações de sistema.
- **Analista** — operação do dia a dia (cadastro, tarefas, interações).
- **Leitura** — consulta apenas.

> Nota: distinto do `role` usado em `organization_contacts` (cargo exercido pela pessoa na organização) — não confundir os dois usos da palavra "papel/role" no sistema.
