import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { fetchEntityOrNull } from "@/lib/supabase/fetch-entity-or-not-found";
import { OrganizationLinks, type OrganizationLinkRow } from "../organization-links";
import { InteractionsTimeline, type InteractionRow } from "@/components/shared/interactions-timeline";
import { ContactEditDelete } from "./contact-edit-delete";
import type { Database } from "@/types/database";

type Contact = Database["crm_abvcap"]["Tables"]["contacts"]["Row"];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("ContactsPage");
  const supabase = await createClient();

  const contact = await fetchEntityOrNull<Contact>(supabase, "contacts", id);
  if (!contact) notFound();

  const [{ data: tagLinks }, { data: orgLinks }, { data: organizations }, { data: participantRows }] =
    await Promise.all([
      supabase
        .from("entity_tags")
        .select("tags(name)")
        .eq("entity_type", "contact")
        .eq("entity_id", id),
      supabase
        .from("organization_contacts")
        .select("id, org_id, role, start_date, end_date, organizations(name)")
        .eq("contact_id", id)
        .order("start_date", { ascending: false }),
      supabase.from("organizations").select("id, name").order("name", { ascending: true }),
      supabase
        .from("interaction_participants")
        .select("interactions(id, type, occurred_at, summary, classification_level)")
        .eq("participant_type", "contact")
        .eq("participant_id", id),
    ]);

  const tags = (tagLinks ?? [])
    .map((link) => (link.tags as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  const organizationLinks: OrganizationLinkRow[] = (orgLinks ?? []).map((link) => ({
    id: link.id,
    org_id: link.org_id,
    org_name: (link.organizations as { name: string } | null)?.name ?? "",
    role: link.role,
    start_date: link.start_date,
    end_date: link.end_date,
  }));

  const interactions: InteractionRow[] = (participantRows ?? [])
    .map((row) => row.interactions as InteractionRow | null)
    .filter((interaction): interaction is InteractionRow => Boolean(interaction))
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{initials(contact.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{contact.full_name}</h1>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <ContactEditDelete contact={contact} contactTags={tags} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <InteractionsTimeline
            participantType="contact"
            participantId={id}
            interactions={interactions}
          />
        </div>
        <div className="flex w-full flex-col gap-6 lg:w-80">
          <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
            <h3 className="mb-1 text-sm font-medium text-foreground">{t("fieldEmails")}</h3>
            {contact.emails?.length ? (
              contact.emails.map((email) => <span key={email}>{email}</span>)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">{t("fieldPhones")}</h3>
            {contact.phones?.length ? (
              contact.phones.map((phone) => <span key={phone}>{phone}</span>)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {contact.linkedin_url && (
              <>
                <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
                  {t("fieldLinkedin")}
                </h3>
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {contact.linkedin_url}
                </a>
              </>
            )}
            {contact.notes && (
              <>
                <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">{t("fieldNotes")}</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{contact.notes}</p>
              </>
            )}
          </div>

          <OrganizationLinks contactId={id} links={organizationLinks} organizations={organizations ?? []} />
        </div>
      </div>
    </div>
  );
}
