# ADR-004: `deals` como Entidade Própria (Inteligência, não Funil Comercial)

- **Status**: Aceito
- **Data**: 2026-09-29
- **Origem**: inconsistência identificada entre Anexo B e Anexo C do documento normativo (ver pendência registrada em ADR-001).

## Contexto

O Anexo C usa "deals em andamento" e "mandatos de investimento" como exemplo central de dado `RESTRICTED`/`CONFIDENTIAL`, mas o Anexo B (modelo de dados) não define nenhuma tabela para eles. Ao mesmo tempo, a Seção 1.2 exclui explicitamente da v1 o **"funil de vendas e gestão de propostas comerciais"**.

Essas duas afirmações não são contraditórias se entendidas corretamente: o que a v1 exclui é um funil de vendas *da própria associação* (estágios de proposta comercial, ganho/perda). O que o Anexo C pede é o registro de **inteligência institucional sensível sobre operações do ecossistema** (ex.: "o Fundo X está em processo de aquisição da Empresa Y") — informação de relacionamento, não pipeline comercial.

## Decisão

Criar a tabela `deals` como entidade de primeira classe, com semântica de **registro informativo confidencial**, não de funil de vendas:

```
deals
├── id                      UUID
├── organization_id         UUID  -- tenant
├── related_organization_id UUID  -- fundo/organização protagonista do deal
├── name                    TEXT  -- título descritivo
├── deal_type               TEXT  -- aquisição | rodada_investimento | fusao | ipo | outro
├── status                  TEXT  -- em_andamento | concluido | cancelado (ciclo de vida simples, NÃO estágios de funil comercial)
├── classification_level    TEXT  -- CONFIDENTIAL | RESTRICTED (default RESTRICTED)
├── summary                 TEXT
├── target_or_actual_date   DATE
├── created_at / updated_at TIMESTAMPTZ
└── created_by              UUID

deal_participants            -- junção N:N com contacts e organizations
├── deal_id                  UUID
├── contact_id               UUID NULL
├── organization_id_ref       UUID NULL  -- organização participante (advisor, LP, etc.)
├── role                     TEXT  -- ex.: GP líder, advisor, LP investidor
```

`deals` segue as mesmas regras de RLS e auditoria de todo dado `RESTRICTED` (ADR-001): default-deny, grant obrigatório via `entity_access_grants`, leitura audita em `audit_log`, bloqueado por padrão para embeddings/IA.

## Consequências

- Nova especificação funcional obrigatória em `docs/specs/deals.md` antes da migration (regra da skill `10-documentation-context`).
- Módulo `src/modules/deals/` segue a mesma estrutura padrão (`components/services/schemas/types.ts`).
- **Não** introduzir estágios de funil comercial, metas de conversão ou métricas de "ganho/perda" — isso permanece fora de escopo da v1 (Seção 1.2). Qualquer pedido futuro nesse sentido exige novo ADR e é uma mudança de escopo, não uma extensão natural desta entidade.
- Atualiza o Anexo B efetivo do projeto (a versão viva agora é este ADR + `docs/specs/deals.md`, não mais apenas o docx original).
