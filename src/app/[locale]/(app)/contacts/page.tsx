import { createClient } from "@/lib/supabase/server";
import { ContactsTable } from "./contacts-table";

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("full_name", { ascending: true });

  const contactIds = (contacts ?? []).map((contact) => contact.id);

  // entity_tags é polimórfico (entity_type/entity_id) — sem FK para o
  // PostgREST inferir o relacionamento, então o join é feito aqui, não via
  // `select=*,entity_tags(...)`.
  const tagsByContact: Record<string, string[]> = {};
  if (contactIds.length > 0) {
    const { data: links } = await supabase
      .from("entity_tags")
      .select("entity_id, tags(name)")
      .eq("entity_type", "contact")
      .in("entity_id", contactIds);

    for (const link of links ?? []) {
      const tagName = (link.tags as { name: string } | null)?.name;
      if (!tagName) continue;
      (tagsByContact[link.entity_id] ??= []).push(tagName);
    }
  }

  return <ContactsTable contacts={contacts ?? []} tagsByContact={tagsByContact} />;
}
