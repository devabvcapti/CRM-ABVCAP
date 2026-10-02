import { createClient } from "@/lib/supabase/server";
import { OrganizationsTable } from "./organizations-table";

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("*")
    .order("name", { ascending: true });

  return <OrganizationsTable organizations={organizations ?? []} />;
}
