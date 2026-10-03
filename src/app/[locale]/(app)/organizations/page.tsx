import { createClient } from "@/lib/supabase/server";
import { OrganizationsTable, type OrganizationFilterState } from "./organizations-table";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  // RLS de saved_filters já filtra por dono (ver Task 1) — não precisa de
  // .eq("user_profile_id", ...) aqui.
  const { data: savedFilters } = await supabase
    .from("saved_filters")
    .select("id, name, filter_state")
    .eq("entity_type", "organization")
    .order("name");

  return (
    <OrganizationsTable
      organizations={organizations ?? []}
      // filter_state é Json no schema (genérico pra qualquer entidade) — o
      // formato real sempre bate com OrganizationFilterState pra
      // entity_type "organization", já que é o próprio saveFilter desta
      // página que grava esse shape.
      savedFilters={(savedFilters ?? []).map((filter) => ({
        ...filter,
        filter_state: filter.filter_state as OrganizationFilterState,
      }))}
    />
  );
}
