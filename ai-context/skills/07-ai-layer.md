# Skill: camada-de-ia

## Objetivo
Implementar abstração de LLM, índices `pgvector`, rotinas de busca semântica e interfaces com aprovação humana obrigatória. Protege dados `RESTRICTED` e evita lock-in em um único fornecedor de LLM.

## Pré-condições — GATE DE SEGURANÇA (BLOQUEANTE)
- **Fases 0–3 concluídas e homologadas.**
- Policies de RLS e auditoria da matriz de classificação **auditadas e ativas em produção** — não apenas em ambiente de desenvolvimento.
- ADR-001 (classificação de dados) vigente e sem pendências.
- Esta skill **não pode ser iniciada** sem checagem formal explícita do gate acima registrada em `docs/roadmap.md`.

## Passos
1. Criar camada de abstração de provedor de LLM (interface desacoplada — nenhuma chamada direta a SDK proprietário fora dessa camada).
2. Configurar extensão `pgvector` e tabela de indexação vetorial.
3. Implementar regra arquitetural que **impede a indexação e o envio de dados `RESTRICTED`** a qualquer provedor de IA — validação em código, não apenas policy de RLS.
4. Implementar resumo executivo de relacionamento e motor de recomendação de próxima ação (next-best-action).
5. Implementar busca semântica em notas/transcrições respeitando o contexto de permissão do usuário solicitante.
6. Toda saída da IA é apresentada como **rascunho para validação humana** — nunca ação automática irreversível.

## Padrões obrigatórios
- Dados `RESTRICTED`: bloqueados por padrão para embeddings/prompts; opt-in explícito e logado por entidade quando excepcionalmente permitido.
- Nenhum acoplamento direto a um único fornecedor de LLM na lógica de negócio.
- Toda geração de IA é rastreável (`ai_insights` versionado) e nunca sobrescreve dado original do usuário.
- Dado pessoal identificável de `contacts` (nome, e-mail, telefone) não é enviado a provedor de LLM externo sem opt-in e log, mesmo quando classificado `INTERNAL` — reforço de minimização de dados exigido pelo ADR-005 (LGPD), além da classificação de confidencialidade de negócio do ADR-001.

## Checklist de aceite
- [ ] Gate de segurança formalmente validado e registrado antes do primeiro commit desta skill.
- [ ] Teste automatizado comprova que um registro `RESTRICTED` nunca é enviado ao provedor de LLM.
- [ ] Resumos e sugestões aparecem como rascunho, exigindo ação humana explícita para confirmar.
- [ ] Busca semântica respeita RLS do usuário solicitante (sem vazamento cross-tenant ou cross-permissão).
