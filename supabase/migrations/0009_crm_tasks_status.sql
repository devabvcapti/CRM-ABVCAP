-- Adiciona status real a crm_abvcap.tasks (sub-projeto 2 de 4 — quadro
-- Kanban, ver docs/superpowers/specs/2026-10-04-tasks-kanban-design.md).
-- done_at (0008_crm_tasks.sql) passa a ser DERIVADO de status — toda
-- escrita que leva status para 'concluida' grava done_at = now(); qualquer
-- outro valor de status limpa done_at = null (ver setTaskStatus em
-- src/lib/actions/tasks.ts). Sem alteração de RLS: a policy
-- tasks_update_write_roles já existente cobre qualquer coluna do UPDATE.
alter table crm_abvcap.tasks
  add column status text not null default 'a_fazer'
    check (status in ('a_fazer', 'em_andamento', 'concluida'));
