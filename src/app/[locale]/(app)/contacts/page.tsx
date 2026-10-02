import { createClient } from "@/lib/supabase/server";
import { ContactsTable } from "./contacts-table";
import type { OrganizationLinkRow } from "./organization-links";

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
  // org_id tem FK de verdade para organizations.id — esse embed já funciona
  // direto via PostgREST, ao contrário de entity_tags.
  const linksByContact: Record<string, OrganizationLinkRow[]> = {};

  if (contactIds.length > 0) {
    const [{ data: tagLinks }, { data: orgLinks }] = await Promise.all([
      supabase
        .from("entity_tags")
        .select("entity_id, tags(name)")
        .eq("entity_type", "contact")
        .in("entity_id", contactIds),
      supabase
        .from("organization_contacts")
        .select("id, contact_id, org_id, role, start_date, end_date, organizations(name)")
        .in("contact_id", contactIds)
        .order("start_date", { ascending: false }),
    ]);

    for (const link of tagLinks ?? []) {
      const tagName = (link.tags as { name: string } | null)?.name;
      if (!tagName) continue;
      (tagsByContact[link.entity_id] ??= []).push(tagName);
    }

    for (const link of orgLinks ?? []) {
      const orgName = (link.organizations as { name: string } | null)?.name ?? "";
      (linksByContact[link.contact_id] ??= []).push({
        id: link.id,
        org_id: link.org_id,
        org_name: orgName,
        role: link.role,
        start_date: link.start_date,
        end_date: link.end_date,
      });
    }
  }

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <ContactsTable
      contacts={contacts ?? []}
      tagsByContact={tagsByContact}
      linksByContact={linksByContact}
      organizations={organizations ?? []}
    />
  );
}
