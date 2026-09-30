# ADR-005: Conformidade LGPD para Dados Pessoais de Contatos

- **Status**: Aceito
- **Data**: 2026-09-29
- **Origem**: gap identificado na análise crítica do documento normativo — não mencionado explicitamente no documento original, apesar de o sistema tratar dados pessoais (nome, e-mail, telefone, cargo, LinkedIn) de centenas de pessoas físicas do ecossistema.

## Contexto

A Lei Geral de Proteção de Dados (LGPD) se aplica a qualquer tratamento de dados pessoais no Brasil, independentemente do porte da organização. A tabela `contacts` e as tabelas relacionadas (`organization_contacts`, `interactions`, `notes`) concentram dados pessoais de GPs, LPs, executivos e demais contatos do ecossistema de PE/VC — a maioria sem relação de emprego direta com a ABVCAP, o que exige base legal de tratamento cuidadosamente justificada (tipicamente **legítimo interesse** institucional/associativo, dado o propósito de relacionamento setorial).

## Decisão

1. **Base legal**: o tratamento dos dados de `contacts` se apoia em legítimo interesse (art. 7º, IX da LGPD), documentado em relatório de impacto (RIPD) simplificado a ser anexado em `docs/`.
2. **Minimização**: campos de `contacts` limitados ao necessário para a finalidade de relacionamento institucional — nenhum dado sensível (art. 5º, II) é coletado nesta v1 (saúde, opinião política, etc.).
3. **Direito de exclusão/retificação**: processo administrativo (não necessariamente self-service na v1) para atender solicitações de titulares — registrado como capacidade do papel Admin, com trilha de auditoria em `audit_log` para toda exclusão de dado pessoal.
4. **Retenção**: sem prazo de expurgo automático na v1 (justificado pelo propósito de "memória institucional" de longo prazo), mas com processo documentado para exclusão mediante solicitação do titular ou decisão da associação.
5. **Auditoria de acesso**: já coberta estruturalmente por `audit_log`/`entity_access_grants` (ADR-001) — reaproveitada para atender ao princípio de responsabilização (accountability) da LGPD, sem necessidade de mecanismo paralelo.
6. **Compartilhamento com terceiros**: nenhuma integração de Fase 5 (OAuth Google/Microsoft) ou camada de IA (Fase 4) pode enviar dado pessoal identificável a um provedor externo sem que isso esteja coberto por este ADR ou por um ADR subsequente específico.

## Consequências

- `docs/specs/contacts.md` (a criar na Fase 1) deve referenciar este ADR e detalhar os campos coletados e sua finalidade.
- A skill `07-ai-layer` (Fase 4) herda a restrição: nenhum dado pessoal de `contacts` é enviado a provedor de LLM externo sem opt-in e log, mesmo quando classificado como `INTERNAL` (reforço do princípio de minimização para IA, além da classificação de confidencialidade de negócio já coberta pelo ADR-001).
- Processo de atendimento a titulares de dados (solicitação de exclusão/correção) deve ser desenhado na Fase 1, junto ao CRUD de contatos.
