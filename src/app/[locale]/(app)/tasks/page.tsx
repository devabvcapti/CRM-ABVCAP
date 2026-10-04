import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";
import type { TaskStatus } from "@/lib/actions/tasks";
import { TasksKanban, type TaskCard } from "./tasks-kanban";

// Cap padrão do PostgREST (`max_rows`) por resposta — qualquer query SEM
// `.range()` sobre uma tabela que passe desse tamanho trunca silenciosamente.
// Usado como tamanho de lote pelo `fetchAllRows` abaixo (achado do review
// final: `/tasks` lia `tasks`/`contacts`/`organizations` inteiras sem
// paginação nenhuma — na escala alvo do projeto, ~5 mil contatos, a maioria
// dos cards de tarefa vinculada a Contato mostraria nome em branco, e uma vez
// `tasks` passar de 1000 linhas o quadro perderia um subconjunto arbitrário
// de tarefas sem nenhum erro visível). Mesmo padrão já estabelecido em
// `contacts/page.tsx` (`fetchAllRows`/`CATALOG_BATCH_SIZE`) — cada página que
// precisa mantém sua própria cópia local (não exportado de lá).
const CATALOG_BATCH_SIZE = 1000;

// Pagina exaustivamente sobre uma query que devolve no máximo
// `CATALOG_BATCH_SIZE` linhas por chamada — `fetchPage` recebe o range de
// cada lote e deve devolver uma query NOVA a cada chamada (o query builder do
// supabase-js não é reutilizável depois de `await`); repete até um lote vir
// com menos linhas que o tamanho do lote (sinal de que chegou ao fim). Lança
// se qualquer lote vier com erro — nunca engolir erro do Supabase, mesmo
// dentro de um helper de catálogo (era exatamente isso que a desestruturação
// antiga `const [{ data: taskRows }, ...]` fazia, descartando `error` e
// virando "0 registros" silencioso em vez de uma falha visível).
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + CATALOG_BATCH_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < CATALOG_BATCH_SIZE) break;
    offset += CATALOG_BATCH_SIZE;
  }
  return rows;
}

export default async function TasksPage() {
  const t = await getTranslations("TasksList");
  const supabase = await createClient();

  // Mostra TODAS as tarefas do CRM, sem filtro (decisão do spec) — tasks é
  // polimórfico (Contato OU Organização), então resolvemos o nome do
  // participante com dois mapas separados por tipo (ver Review Focus: uma
  // lista mista não pode cruzar os dois tipos).
  //
  // tasks também tem created_by -> user_profiles (0008_crm_tasks.sql) — sem
  // o hint de FK, o embed de user_profiles(name) é ambíguo pro PostgREST
  // (mesmo motivo já documentado nas páginas de detalhe de Contato/
  // Organização).
  //
  // As 3 queries são independentes entre si — rodam em paralelo, não em
  // série. Cada uma pagina exaustivamente via `fetchAllRows` (Fix 3 do review
  // final) com um `.order()` determinístico: sem ordem explícita, Postgres
  // não garante que `.range()` particiona a tabela de forma estável entre
  // chamadas sucessivas do MESMO read, podendo pular ou repetir linha entre
  // lotes. `contacts`/`organizations` ordenam só por `id` (mapa id->nome, sem
  // ordem de exibição que importe); `tasks` ordena por `due_date` primeiro
  // (dá ao array resultante uma ordem intencional, mais vencida primeiro) com
  // `id` como tie-breaker (é ele que garante o particionamento determinístico
  // entre lotes — mesmo padrão de múltiplas colunas + tie-breaker de `id` já
  // usado em `contacts/page.tsx`).
  const [taskRows, contacts, organizations] = await Promise.all([
    fetchAllRows<{
      id: string;
      description: string;
      due_date: string;
      assigned_to: string;
      status: string;
      participant_type: string;
      participant_id: string;
      user_profiles: { name: string } | null;
    }>((from, to) =>
      supabase
        .from("tasks")
        .select(
          "id, description, due_date, assigned_to, status, participant_type, participant_id, user_profiles!tasks_assigned_to_fkey(name)",
        )
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string }>((from, to) =>
      supabase
        .from("contacts")
        .select("id, full_name")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase
        .from("organizations")
        .select("id, name")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const profile = await getCurrentProfile();
  // (app)/layout.tsx já redireciona pra /login antes de qualquer página
  // aninhada renderizar se não houver perfil — este notFound() é só pra
  // satisfazer o TypeScript (getCurrentProfile() retorna `| null`), nunca
  // deve disparar de verdade em uso normal.
  if (!profile) notFound();

  const contactNames = new Map(contacts.map((contact) => [contact.id, contact.full_name]));
  const organizationNames = new Map(organizations.map((org) => [org.id, org.name]));

  // Calculado uma vez, no topo — não recalculado por tarefa (ver Review
  // Focus sobre o selo de atraso/vencimento).
  const now = new Date();

  // Sempre inicializa as 3 chaves, mesmo vazias — KanbanColumnContent
  // (componente vendorizado) lança erro se uma coluna não existir no value.
  const columns: Record<TaskStatus, TaskCard[]> = {
    a_fazer: [],
    em_andamento: [],
    concluida: [],
  };

  for (const row of taskRows) {
    const participantType = row.participant_type as "contact" | "organization";
    const participantName =
      participantType === "contact"
        ? (contactNames.get(row.participant_id) ?? "")
        : (organizationNames.get(row.participant_id) ?? "");

    const status = row.status as TaskStatus;
    // Sinal PURO, função só de due_date vs. agora — nunca de `status`
    // (achado do review final). O gate que esconde o selo enquanto a
    // tarefa está em "Concluída" já é feito no CLIENTE
    // (tasks-kanban.tsx, comparando contra a coluna ATUAL de renderização,
    // não contra este valor). Gatear aqui também, pelo `status` carregado
    // do banco no momento do fetch, "congelaria" o sinal como `false` pra
    // sempre numa tarefa concluída — se ela for arrastada de volta pra "A
    // Fazer"/"Em Andamento" na mesma sessão do navegador, o selo nunca
    // reapareceria (o estado local do Kanban nunca recalcula isOverdue a
    // partir de due_date, só herda o valor que já veio do servidor).
    const isOverdue = new Date(row.due_date) < now;
    const isDueSoon =
      !isOverdue && new Date(row.due_date).getTime() - now.getTime() <= 24 * 60 * 60 * 1000;

    const card: TaskCard = {
      id: row.id,
      description: row.description,
      due_date: row.due_date,
      assignedToId: row.assigned_to,
      assignedToName: (row.user_profiles as { name: string } | null)?.name ?? "",
      participantType,
      participantId: row.participant_id,
      participantName,
      isOverdue,
      isDueSoon,
    };

    columns[status].push(card);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <TasksKanban columns={columns} currentProfileId={profile.id} />
    </div>
  );
}
