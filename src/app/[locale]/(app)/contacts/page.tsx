import { createClient } from "@/lib/supabase/server";
import { ContactsTable, type ContactFilterState } from "./contacts-table";

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
    const { data: tagLinks } = await supabase
      .from("entity_tags")
      .select("entity_id, tags(name)")
      .eq("entity_type", "contact")
      .in("entity_id", contactIds);

    for (const link of tagLinks ?? []) {
      const tagName = (link.tags as { name: string } | null)?.name;
      if (!tagName) continue;
      (tagsByContact[link.entity_id] ??= []).push(tagName);
    }
  }

  // organization_contacts.contact_id/org_id são FK de verdade (ao contrário
  // de entity_tags), então o embed organizations(id, name) do PostgREST
  // funciona direto. Só o vínculo atual (end_date null) conta como "empresa"
  // do contato — se um contato tiver mais de um vínculo atual simultâneo
  // (tecnicamente possível pelo schema, incomum na prática), fica o último
  // da lista, mesmo "último vence" de qualquer outro Record montado em loop.
  const organizationByContact: Record<string, { id: string; name: string }> = {};
  if (contactIds.length > 0) {
    const { data: orgLinks } = await supabase
      .from("organization_contacts")
      .select("contact_id, organizations(id, name)")
      .is("end_date", null)
      .in("contact_id", contactIds);

    for (const link of orgLinks ?? []) {
      const org = link.organizations as { id: string; name: string } | null;
      if (!org) continue;
      organizationByContact[link.contact_id] = org;
    }
  }

  // RLS de saved_filters já filtra por dono (ver Task 1) — não precisa de
  // .eq("user_profile_id", ...) aqui.
  const { data: savedFilters } = await supabase
    .from("saved_filters")
    .select("id, name, filter_state")
    .eq("entity_type", "contact");

  return (
    <ContactsTable
      contacts={contacts ?? []}
      tagsByContact={tagsByContact}
      organizationByContact={organizationByContact}
      // filter_state é Json no schema (genérico pra qualquer entidade) — o
      // formato real sempre bate com ContactFilterState pra entity_type
      // "contact", já que é o próprio saveFilter desta página que grava esse
      // shape.
      savedFilters={(savedFilters ?? []).map((filter) => ({
        ...filter,
        filter_state: filter.filter_state as ContactFilterState,
      }))}
    />
  );
}
