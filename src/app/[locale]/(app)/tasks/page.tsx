import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-profile";
import type { TaskStatus } from "@/lib/actions/tasks";
import { TasksKanban, type TaskCard } from "./tasks-kanban";

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
  const [{ data: taskRows }, { data: contacts }, { data: organizations }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, description, due_date, assigned_to, status, participant_type, participant_id, user_profiles!tasks_assigned_to_fkey(name)",
      ),
    supabase.from("contacts").select("id, full_name"),
    supabase.from("organizations").select("id, name"),
  ]);

  const profile = await getCurrentProfile();
  // (app)/layout.tsx já redireciona pra /login antes de qualquer página
  // aninhada renderizar se não houver perfil — este notFound() é só pra
  // satisfazer o TypeScript (getCurrentProfile() retorna `| null`), nunca
  // deve disparar de verdade em uso normal.
  if (!profile) notFound();

  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.full_name]));
  const organizationNames = new Map((organizations ?? []).map((org) => [org.id, org.name]));

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

  for (const row of taskRows ?? []) {
    const participantType = row.participant_type as "contact" | "organization";
    const participantName =
      participantType === "contact"
        ? (contactNames.get(row.participant_id) ?? "")
        : (organizationNames.get(row.participant_id) ?? "");

    const status = row.status as TaskStatus;
    // `status !== "concluida"` como primeira condição — uma tarefa
    // concluída nunca mostra selo de atraso/vencimento, independente da
    // data (ver Review Focus).
    const isOverdue = status !== "concluida" && new Date(row.due_date) < now;
    const isDueSoon =
      status !== "concluida" &&
      !isOverdue &&
      new Date(row.due_date).getTime() - now.getTime() <= 24 * 60 * 60 * 1000;

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
