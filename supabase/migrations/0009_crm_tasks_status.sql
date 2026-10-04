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

-- Backfill: tarefas já concluídas (done_at não-nulo) via o checkbox
-- pré-existente (setTaskDone, sub-projeto 1) foram inseridas quando status
-- ainda não existia, então a coluna acima as preenche com o default
-- 'a_fazer' — inconsistente com a própria premissa de que done_at é
-- DERIVADO de status (ver comentário acima e setTaskStatus em
-- src/lib/actions/tasks.ts). Sem este update, o quadro Kanban (sub-projeto
-- 2 de 4, que lê status como fonte da verdade) mostraria essas tarefas na
-- coluna errada ("A Fazer" em vez de "Concluída").
update crm_abvcap.tasks set status = 'concluida' where done_at is not null;
