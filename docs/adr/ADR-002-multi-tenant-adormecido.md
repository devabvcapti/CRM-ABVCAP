# ADR-002: Arquitetura Multi-tenant Adormecida

- **Status**: Aceito
- **Data**: 2026-09-29
- **Fonte**: Seções 1.3 e 6 do documento normativo de planejamento

## Contexto

A v1 atende exclusivamente à equipe interna da ABVCAP (5–30 usuários simultâneos), sem necessidade imediata de multi-tenant real. Entretanto, a abertura futura para associados ou filiais é uma direção estratégica plausível, e um retrofit de particionamento por tenant em um schema já maduro é uma refatoração cara e arriscada.

## Decisão

Toda tabela do banco de dados, sem exceção, possui a coluna `organization_id` (chave de tenant) desde a primeira migration, mesmo operando hoje com um único tenant efetivo. As policies de RLS já são compostas considerando esse atributo, de forma que o particionamento de acesso entre associações filiadas ou portais de membros no futuro ocorra por ajuste de configuração e papéis, sem exigir alteração de schema.

## Consequências

- Toda migration nova inclui `organization_id NOT NULL` obrigatoriamente — verificado no checklist da skill `02-data-modeling`.
- Seeds e dados de desenvolvimento devem povoar `organization_id` de forma consistente, mesmo com tenant único.
- Nenhum ganho multi-tenant é exposto na UI da v1 — a preparação é estrutural/adormecida, não funcional.
- Decisão revisitável apenas via novo ADR caso se decida abandonar o modelo (não esperado no horizonte deste roadmap).
