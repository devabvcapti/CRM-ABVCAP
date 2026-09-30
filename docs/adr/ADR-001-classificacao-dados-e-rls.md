# ADR-001: Classificação de Dados em 4 Níveis e RLS-First

- **Status**: Aceito
- **Data**: 2026-09-29
- **Fonte**: Anexo C do documento normativo de planejamento

## Contexto

A plataforma armazenará dados institucionais que incluem mandatos e fundos em andamento, tocando segredos comerciais e acordos de confidencialidade estritos. Não há mecanismo de isolamento além do que for aplicado nativamente pelo banco de dados, dado que a interface não pode ser a última linha de defesa.

## Decisão

Todo registro do sistema se enquadra em exatamente um de quatro níveis de classificação:

| Nível | Exemplos | Regra de acesso | Uso por IA |
|---|---|---|---|
| `PUBLIC` | Associados ativos, agenda de eventos abertos | Acesso total a autenticados | Livre |
| `INTERNAL` | Contatos básicos, reuniões padrão, tarefas rotineiras | Acesso a todo operador autenticado | Livre (resumos, indexação) |
| `CONFIDENTIAL` | Teses setoriais, dados estruturais de fundos, mandatos, interlocução com LPs | Default-deny; exige grant ativo em `entity_access_grants` | Só com grant ativo |
| `RESTRICTED` | Deals em andamento, NDAs, minutas societárias, due diligence | Default-deny estrito; grant obrigatório; toda leitura audita em `audit_log` | Bloqueado por padrão; opt-in explícito e logado |

O isolamento de `CONFIDENTIAL` e `RESTRICTED` é implementado nativamente via Row Level Security do Postgres, nunca por filtragem na interface gráfica. Nenhuma tabela é criada sem policy de RLS declarada na mesma migration.

## Consequências

- Toda nova tabela exige decisão explícita de nível de classificação antes da migration.
- Leitura de dado `RESTRICTED` gera custo de auditoria (registro assíncrono imutável).
- A camada de IA (Fase 4) fica bloqueada até que esta política esteja auditada e ativa em produção (gate de segurança).
- Testes negativos (acesso sem grant → retorno vazio) são obrigatórios em toda mudança de policy.

## Pendência identificada nesta formalização

O Anexo B (modelo de dados) não define hoje uma tabela `deals` ou `mandates` explícita, embora o Anexo C cite "deals em andamento" e "mandatos de investimento" como exemplos centrais de `CONFIDENTIAL`/`RESTRICTED`. Avaliar se esses conceitos são modelados como entidades próprias ou como atributos/`custom_fields` de `organizations`/`interactions` — decisão a tomar antes do fim da Fase 0, com um ADR próprio se resultar em novas tabelas.
