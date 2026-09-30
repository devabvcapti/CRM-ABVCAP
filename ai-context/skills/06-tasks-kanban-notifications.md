# Skill: tasks-kanban-notifications

## Objetivo
Implementar fluxos de tarefas, quadros Kanban configuráveis e centro de notificações via Supabase Realtime e e-mail transacional. Coração da rotina operacional da equipe — exige precisão no controle de estado concorrente e permissões granulares.

## Pré-condições
- Núcleo de relacionamento (Fase 1) concluído — `contacts`/`organizations` existentes para associação polimórfica.
- RLS ativa nas tabelas `tasks`, `boards`, `board_columns`, `board_cards`, `notifications`.

## Passos
1. Modelar `tasks`, `task_checklist_items`, `task_observers` com associação polimórfica (`related_type`/`related_id`) à origem (contato, organização, evento, card).
2. Construir Kanban (`boards`/`board_columns`/`board_cards`) com mutação otimista via TanStack Query — reconciliar em caso de conflito de posição/coluna.
3. Configurar Supabase Realtime (`postgres_changes`) para notificações in-app instantâneas.
4. Integrar Resend para e-mails transacionais e digests; templates com fallback de idioma (i18n).
5. Configurar Vercel Cron + `pg_cron` para lembretes de prazo e recorrência de tarefas.
6. Implementar painel de preferências de notificação por canal (in-app / e-mail) e por tipo de evento.

## Padrões obrigatórios
- Toda mutação de estado do Kanban é otimista na UI mas confirmada no servidor — reverter visualmente em caso de falha.
- Notificação nunca depende só do canal in-app para eventos críticos de prazo — respeitar preferência do usuário.
- Observadores de tarefa (`task_observers`) recebem notificação, mas não podem editar a tarefa salvo permissão explícita.

## Checklist de aceite
- [ ] Ciclo ponta a ponta validado: criar tarefa → mover no Kanban → notificação in-app → e-mail.
- [ ] Testes de concorrência: duas mutações simultâneas no mesmo card não corrompem o estado.
- [ ] Preferências de notificação respeitadas nos dois canais.
- [ ] Recorrência de tarefas gera novas instâncias corretamente via `pg_cron`.
