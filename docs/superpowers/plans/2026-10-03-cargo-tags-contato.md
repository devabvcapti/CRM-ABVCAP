# Cargo como campo próprio + picker de Tags no Contato Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar Cargo (título profissional, valor único) de Tag (categorização livre, multivalorada) no Contato — cadastro rápido simplificado para 5 campos (que já cria o vínculo institucional), e um picker de Tags de verdade no detalhe.

**Architecture:** Nova coluna `contacts.title`; `languages`/`linkedin_url` removidas do schema. O form de criar vira um componente novo e enxuto (`ContactCreateForm`) que insere `contacts` + `organization_contacts` numa Server Action só; o form de editar (`ContactForm` existente) perde os campos removidos e ganha Cargo. Tags saem do form inteiramente e passam a um componente novo no detalhe (`ContactTags`), consumindo um picker `Combobox` (já no projeto, nunca usado) contra o catálogo compartilhado de `tags`.

**Tech Stack:** Next.js App Router (Server Actions, Server Components), Supabase (migration destrutiva), next-intl, Playwright, `@base-ui/react` Combobox (`src/components/ui/combobox.tsx`).

**Spec:** `docs/superpowers/specs/2026-10-03-cargo-tags-contato-design.md`

## Global Constraints

- `languages`/`linkedin_url` são removidas via `DROP COLUMN` — destrutivo, já confirmado pelo dono do projeto, não pedir confirmação de novo.
- O campo Cargo nunca é uma tag — não usar `entity_tags`/`tags` para ele em lugar nenhum.
- Valores antigos de "Cargo institucional" (hoje em `entity_tags`) NÃO migram para `contacts.title` — ficam como tags normais. `title` de contatos existentes começa `null` (spec, "Fora de escopo").
- Cadastro rápido: Empresa usa `<Select>` das organizações já existentes (mesmo padrão de `organization-links.tsx`) — nunca autocomplete com criação de organização nova inline (spec, "Fora de escopo").
- Cadastro rápido cria o vínculo institucional via `organization_contacts` de verdade (não um campo leve paralelo) — `role` do vínculo = mesmo valor do Cargo, `start_date` = hoje.
- Nenhuma área de gestão de Tags dedicada (CRUD independente) — só o picker resolvendo "selecionar existente ou criar nova" (spec, "Fora de escopo").
- Nenhuma mudança em `organization_contacts.role` em si, nem no picker de Tags para Organizações (spec, "Fora de escopo").
- Nenhum texto hardcoded na UI — toda string nova entra em `src/messages/pt-BR.json` e `src/messages/en-US.json`, sempre pareada.
- Rodar a suíte E2E completa (`npx playwright test`) depois de CADA task que toca uma página real — nunca só a suíte parcial.

## Review Focus

- **Cadastro rápido com campo obrigatório vazio** (ex.: Telefone em branco): o form deve bloquear o submit com erro visível, nunca criar um contato pela metade. Task 1 testa isso.
- **Picker de Tags oferecendo uma tag já anexada ao contato como "pra adicionar"**: a lista de opções do Combobox precisa excluir as tags que o contato já tem — senão um clique gera um insert duplicado em `entity_tags` (que tem `unique(tag_id, entity_type, entity_id)`, erro 23505 desnecessário). Task 2 testa isso.
- **Criar tag com nome igual a uma já existente** (espaços a mais/a menos): o upsert por nome tem que anexar a tag existente, não criar uma duplicata — depende de aparar (`trim()`) o texto antes de comparar/upsertar. Task 2 testa isso explicitamente (criar uma tag com o mesmo nome de uma já existente, mas com espaços extras, e confirmar que não aparece duplicada no catálogo).
- **Segunda escrita do cadastro rápido falhando** (o insert em `contacts` funciona, o insert em `organization_contacts` falha): o form não pode reportar sucesso nesse caso. Coberto por construção no código do Step 4 da Task 1 (`if (linkError) return { error: "generic" }`, nunca retorna `success: true` se a segunda escrita falhar), não por um teste E2E dedicado — forçar esse cenário via E2E exigiria injetar uma falha artificial no segundo insert, o que não é praticável sem mockar a camada de dados (fora do padrão deste projeto, que testa contra o banco real). Mesmo raciocínio já aceito no plano anterior para "valor órfão em filtro salvo" (garantia por construção, não automatizada).
- **Cargo vazio/null em contato existente**: lista e detalhe não podem renderizar a palavra "null" nem quebrar — mostram vazio/traço. Task 1 testa isso.

---

### Task 1: Migration + Server Actions + forms de criar/editar + coluna da lista

**Files:**
- Create: `supabase/migrations/0007_crm_contact_title.sql`
- Modify: `src/types/database.ts` (regenerado via CLI, não editado à mão)
- Modify: `src/app/[locale]/(app)/contacts/actions.ts`
- Modify: `src/app/[locale]/(app)/contacts/contact-form.tsx`
- Create: `src/app/[locale]/(app)/contacts/contact-create-form.tsx`
- Modify: `src/app/[locale]/(app)/contacts/contacts-table.tsx`
- Modify: `src/app/[locale]/(app)/contacts/page.tsx`
- Modify: `src/app/[locale]/(app)/contacts/[id]/contact-edit-delete.tsx`
- Modify: `src/app/[locale]/(app)/contacts/[id]/page.tsx` (só o header — ver Task 2 pra o resto desse arquivo)
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Modify: `e2e/contacts.spec.ts`

**Interfaces:**
- Consumes: `organizations` (lista `{id, name}[]`, mesmo shape já usado em `organization-links.tsx`).
- Produces: `contacts.title` (coluna nova) — consumida por Task 2 (header do detalhe já usa, mas Task 2 não mexe nela). `ContactCreateForm` — usado só por `contacts-table.tsx` (nenhuma outra task consome).

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0007_crm_contact_title.sql`:

```sql
alter table crm_abvcap.contacts
  add column title text,
  drop column languages,
  drop column linkedin_url;
```

- [ ] **Step 2: Aplicar a migration**

Run: `SUPABASE_DB_PASSWORD=<senha> npx supabase db push --linked` (mesmo processo já usado nesta sessão — `SUPABASE_ACCESS_TOKEN` precisa ser o da organização ABVCAP, confirmar com `npx supabase projects list` antes se houver dúvida).
Expected: migration `0007_crm_contact_title` aplicada sem erro.

- [ ] **Step 3: Regenerar tipos TypeScript**

Run: `SUPABASE_ACCESS_TOKEN=<token> npx supabase gen types typescript --linked --schema crm_abvcap > src/types/database.ts`
Expected: `Database["crm_abvcap"]["Tables"]["contacts"]["Row"]` tem `title: string | null`, não tem mais `languages`/`linkedin_url`.

- [ ] **Step 4: Reescrever `createContact` e `updateContact`, remover `syncTags`**

Em `src/app/[locale]/(app)/contacts/actions.ts`:

```tsx
const contactCreateSchema = z.object({
  full_name: z.string().min(1),
  title: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
  org_id: z.string().min(1),
});

export type ContactCreateFormState = {
  error:
    | "required_name"
    | "required_title"
    | "required_email"
    | "required_phone"
    | "required_org"
    | "generic"
    | null;
  success?: boolean;
  id?: string;
};

export async function createContact(
  _prevState: ContactCreateFormState,
  formData: FormData,
): Promise<ContactCreateFormState> {
  const parsed = contactCreateSchema.safeParse({
    full_name: formData.get("full_name"),
    title: formData.get("title"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    org_id: formData.get("org_id"),
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.full_name) return { error: "required_name" };
    if (fieldErrors.title) return { error: "required_title" };
    if (fieldErrors.email) return { error: "required_email" };
    if (fieldErrors.phone) return { error: "required_phone" };
    return { error: "required_org" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      full_name: parsed.data.full_name,
      title: parsed.data.title,
      emails: [parsed.data.email],
      phones: [parsed.data.phone],
    })
    .select("id")
    .single();

  if (error || !data) return { error: "generic" };

  // Review Focus: se este segundo insert falhar, o contato acima já
  // existe (risco aceito pela spec, sem transação) — mas o form NUNCA
  // pode reportar sucesso nesse caso.
  const { error: linkError } = await supabase.from("organization_contacts").insert({
    contact_id: data.id,
    org_id: parsed.data.org_id,
    role: parsed.data.title,
  });
  if (linkError) return { error: "generic" };

  revalidateContacts();
  return { error: null, success: true, id: data.id };
}
```

`updateContact`: remover `languages`/`linkedin_url`/`tags` do `contactSchema`/`parseForm`/`.update(...)`, adicionar `title: z.string().optional()` e incluir no `.update(...)`. `ContactFormState` (tipo já existente) não muda de shape (`required_name | generic | null` já cobre o que sobra). Remover a função `syncTags` inteira (Task 2 cria funções novas com semântica diferente — nada mais chama `syncTags` depois desta task).

- [ ] **Step 5: Editar `contact-form.tsx` (vira edit-only)**

`contact?: Contact` vira `contact: Contact` (obrigatório). Remover prop `contactTags` inteira. Remover os campos Idiomas, LinkedIn e Cargo institucional (tags) do JSX. Adicionar campo Cargo: `<Input id="title" name="title" defaultValue={contact.title ?? ""} />` com label `t("fieldTitle")`, posicionado onde "Cargo institucional" estava. Mantém: Nome completo, E-mails, Telefones, Notas. `action` sempre `updateContact.bind(null, contact.id)` (não precisa mais do ternário criar/editar, já que este componente só edita agora).

- [ ] **Step 6: Criar `contact-create-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createContact, type ContactCreateFormState } from "./actions";

const initialState: ContactCreateFormState = { error: null };

export function ContactCreateForm({
  organizations,
  onSaved,
}: {
  organizations: { id: string; name: string }[];
  onSaved: (state: ContactCreateFormState) => void;
}) {
  const t = useTranslations("ContactsPage");
  const [state, formAction, isPending] = useActionState(createContact, initialState);

  useEffect(() => {
    if (state.success) onSaved(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // corpo: mapear state.error pra t("errorRequiredName"/"errorRequiredTitle"/
  // "errorRequiredEmail"/"errorRequiredPhone"/"linkErrorRequiredOrg"/
  // "errorGeneric") — mesmo padrão de errorMessage já usado em
  // contact-form.tsx/organization-form.tsx. JSX: SheetContent > form > 5
  // Fields (full_name, title, email, phone, org_id) — org_id é um <Select>
  // igual o de organization-links.tsx:62-80 (SelectValue com children
  // função, não mostra o uuid bruto), label t("fieldCompany"). Footer:
  // botão submit (t("submitCreate")/t("submitting")) + SheetClose
  // (t("cancel")).
}
```

- [ ] **Step 7: Buscar `organizations` em `contacts/page.tsx` e repassar**

```tsx
const { data: organizations } = await supabase
  .from("organizations")
  .select("id, name")
  .order("name", { ascending: true });
```

Passar `organizations={organizations ?? []}` pro `ContactsTable`.

- [ ] **Step 8: Trocar `ContactForm` por `ContactCreateForm` em `contacts-table.tsx`**

O Sheet de criar (hoje `<ContactForm key={formKey} onSaved={handleSaved} />`, sem prop `contact`) vira `<ContactCreateForm key={formKey} organizations={organizations} onSaved={handleSaved} />`. `ContactsTable` ganha prop nova `organizations: { id: string; name: string }[]`. Coluna "tags" (hoje lê `tagsByContact[row.original.id]` e renderiza badges) vira:

```tsx
{
  id: "title",
  accessorKey: "title",
  header: t("colTitle"),
  enableSorting: false,
  cell: (info) => (info.getValue() as string | null) ?? "—",
},
```

`tagsByContact` continua sendo usado pelo filtro de Tag (já existe, não mexe) — só a definição da COLUNA muda, a prop e o filtro ficam como estão.

- [ ] **Step 9: Ajustar `contact-edit-delete.tsx`**

Remover prop `contactTags` (não é mais passada pro `ContactForm`, que não aceita mais essa prop).

- [ ] **Step 10: Ajustar o header do detalhe em `[id]/page.tsx`**

Trocar o `<div className="flex flex-wrap gap-1">{tags.map(...)}</div>` (badges) por `{contact.title && <p className="text-sm text-muted-foreground">{contact.title}</p>}` logo abaixo do nome. Não remover a query de `tagLinks`/variável `tags` — Task 2 reaproveita e estende. `ContactEditDelete` perde a prop `contactTags={tags}` na chamada (já não aceita mais).

- [ ] **Step 11: Chaves de i18n**

Remover de `pt-BR.json`/`en-US.json` (`ContactsPage`): `fieldTags`, `fieldTagsHint`, `fieldLanguages`, `fieldLinkedin`. Renomear `colTags` → `colTitle` (mantém o valor "Cargo"/"Role"→ajustar pra "Title" em en-US se fizer mais sentido, critério do implementador, só manter pareado). Adicionar: `fieldTitle` ("Cargo"), `fieldEmail` ("E-mail", singular — diferente de `fieldEmails` plural que continua existindo pro form de editar), `fieldPhone` ("Telefone", singular), `fieldCompany` ("Empresa"), `errorRequiredTitle`, `errorRequiredEmail`, `errorRequiredPhone` (mesmo padrão de `errorRequiredName` já existente).

- [ ] **Step 12: Rodar a suíte E2E completa**

Run: `npx playwright test`
Expected: todos os testes existentes continuam passando (o teste de criar contato em `contacts.spec.ts` vai quebrar até o Step 13 reescrevê-lo — esperado, confirmar que QUEBRA exatamente nos pontos esperados: campos removidos, form novo).

- [ ] **Step 13: Reescrever o fluxo de criação em `e2e/contacts.spec.ts`**

Onde os testes hoje preenchem `#full_name`/`#tags` no dialog "Novo contato", trocar para os 5 campos novos (`#full_name`, `#title`, `#email`, `#phone`, `#org_id` via Select). Depois de criar, navegar pro detalhe e confirmar: (a) o vínculo institucional com a organização escolhida aparece na seção de vínculos (Review Focus: cadastro rápido cria o vínculo de verdade); (b) o Cargo aparece como texto no header, não como badge. Adicionar um teste (ou estender um existente) que tenta submeter o form de criar com um campo obrigatório vazio (ex.: telefone) e confirma que aparece erro visível e nenhum contato foi criado (Review Focus: campo obrigatório vazio). Adicionar um teste que edita um contato existente e confirma que os campos Idiomas e LinkedIn não aparecem mais no form nem no detalhe (Review Focus implícito: remoção completa). Adicionar um teste (ou assertion) confirmando que um contato com `title` null mostra "—" na coluna da lista, não a palavra "null" (Review Focus: Cargo vazio).

- [ ] **Step 14: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo os novos do Step 13.

- [ ] **Step 15: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos passam.

- [ ] **Step 16: Commit**

```bash
git add supabase/migrations/0007_crm_contact_title.sql src/types/database.ts "src/app/[locale]/(app)/contacts/actions.ts" "src/app/[locale]/(app)/contacts/contact-form.tsx" "src/app/[locale]/(app)/contacts/contact-create-form.tsx" "src/app/[locale]/(app)/contacts/contacts-table.tsx" "src/app/[locale]/(app)/contacts/page.tsx" "src/app/[locale]/(app)/contacts/[id]/contact-edit-delete.tsx" "src/app/[locale]/(app)/contacts/[id]/page.tsx" e2e/contacts.spec.ts src/messages/pt-BR.json src/messages/en-US.json
git commit -m "feat: Cargo vira campo próprio do Contato, remove Idiomas/LinkedIn"
```

---

### Task 2: Picker de Tags no detalhe do Contato

**Files:**
- Create: `src/app/[locale]/(app)/contacts/[id]/contact-tags.tsx`
- Modify: `src/app/[locale]/(app)/contacts/actions.ts`
- Modify: `src/app/[locale]/(app)/contacts/[id]/page.tsx`
- Modify: `src/messages/pt-BR.json`, `src/messages/en-US.json`
- Modify: `e2e/contacts.spec.ts`

**Interfaces:**
- Consumes: nada de Task 1 além do que já está em produção (Combobox de `src/components/ui/combobox.tsx`, inalterado por este plano).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Ler `src/components/ui/combobox.tsx` inteiro**

Confirmar a API exata de multi-seleção com chips (`Combobox`/`ComboboxChips`/`ComboboxChip`/`ComboboxInput`/`ComboboxContent`/`ComboboxList`/`ComboboxItem`/`ComboboxEmpty`) antes de escrever o componente — é Base UI (`@base-ui/react`), ainda não usado em nenhum lugar do projeto.

- [ ] **Step 2: Implementar `addTagToContact`/`removeTagFromContact` em `actions.ts`**

```tsx
export async function addTagToContact(
  contactId: string,
  tagName: string,
): Promise<{ error: boolean }> {
  const trimmed = tagName.trim();
  if (!trimmed) return { error: true };

  const supabase = await createClient();
  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .upsert({ name: trimmed }, { onConflict: "organization_id,name" })
    .select("id")
    .single();
  if (tagError || !tag) return { error: true };

  const { error } = await supabase.from("entity_tags").insert({
    tag_id: tag.id,
    entity_type: "contact",
    entity_id: contactId,
  });
  if (error) return { error: true };

  revalidateContacts();
  return { error: false };
}

export async function removeTagFromContact(entityTagId: string): Promise<{ error: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("entity_tags").delete().eq("id", entityTagId);
  if (error) return { error: true };
  revalidateContacts();
  return { error: false };
}
```

- [ ] **Step 3: Estender a query de `tagLinks` em `[id]/page.tsx`**

`select("tags(name)")` vira `select("id, tags(id, name)")` (precisa do `id` da linha de `entity_tags` pra poder remover depois, e do `id` da tag em si pra excluir das opções do picker). Buscar também o catálogo inteiro: `const { data: allTags } = await supabase.from("tags").select("id, name").order("name", { ascending: true })` (query nova, paralela às outras no mesmo `Promise.all`).

- [ ] **Step 4: Implementar `ContactTags` em `contact-tags.tsx`**

```tsx
"use client";

export function ContactTags({
  contactId,
  tags,
  allTags,
}: {
  contactId: string;
  tags: { entityTagId: string; tagId: string; name: string }[];
  allTags: { id: string; name: string }[];
}) {
  // corpo: badges das `tags` já anexadas (Badge + botão pequeno de remover
  // chamando removeTagFromContact(entityTagId), mesmo padrão de
  // window.confirm não é necessário aqui — remover tag é reversível,
  // diferente de excluir contato/organização). Botão "Adicionar tag" abre
  // um Combobox (ver Step 1) com `items = allTags.filter(t =>
  // !tags.some(attached => attached.tagId === t.id))` (Review Focus:
  // nunca oferecer uma tag já anexada) — selecionar um item chama
  // addTagToContact(contactId, item.name); texto digitado sem match
  // mostra um ComboboxItem fixo tipo t("tagsCreateOption", { query })
  // que, ao ser escolhido, chama addTagToContact(contactId, query) (o
  // upsert por nome já trata "criar" e "anexar existente" com a mesma
  // chamada — Review Focus: nome com espaço a mais não duplica, confiar
  // no `.trim()` do Step 2). Chamadas são diretas (sem useActionState,
  // mesmo padrão de deleteFilter/endOrganizationLink) — sem formulário,
  // é um picker interativo.
}
```

- [ ] **Step 5: Renderizar `ContactTags` em `[id]/page.tsx`**

Nova seção (ex.: logo abaixo do header, ou na barra lateral — critério do implementador, seguir o espaço que os badges antigos ocupavam) com `<ContactTags contactId={id} tags={tags} allTags={allTags ?? []} />`, usando o `tagLinks` já estendido no Step 3 (mapear pra `{entityTagId, tagId, name}`).

- [ ] **Step 6: Chaves de i18n**

Adicionar em `ContactsPage` (ou namespace novo `ContactTags`, critério do implementador — se novo, mesmo padrão de namespace dedicado já usado em `SavedFilters`): `tagsTitle` ("Tags"), `tagsEmpty` ("Nenhuma tag ainda."), `tagsAddButton` ("Adicionar tag"), `tagsSearchPlaceholder`, `tagsCreateOption` (com placeholder `{query}`, ex.: `Criar tag: "{query}"`), `tagsRemoveLabel` (aria-label do botão de remover, idealmente interpolando o nome da tag — mesmo padrão já usado em `SavedFiltersControl`'s `deleteButtonLabel`).

- [ ] **Step 7: Rodar a suíte E2E completa**

Run: `npx playwright test`
Expected: todos os testes existentes (incluindo os novos da Task 1) continuam passando.

- [ ] **Step 8: Estender `e2e/contacts.spec.ts`**

No detalhe de um contato: abrir o picker, criar uma tag nova com nome único (timestamp, ex.: `E2E Tag ${stamp}`) via a opção "criar" — confirmar que vira badge. Reabrir o picker — confirmar que essa tag recém-anexada NÃO aparece mais na lista de opções (Review Focus: não oferecer tag já anexada). Digitar o MESMO nome de novo, mas com espaços extras (ex.: `  E2E Tag ${stamp}  `), e usar a opção "criar" num SEGUNDO contato — confirmar que anexa a tag existente (mesmo id/badge), não cria uma segunda tag com nome quase-igual no catálogo (Review Focus: nome duplicado com espaços não duplica). Apagar a tag do primeiro contato (botão de remover) — confirmar que some do contato mas continua existindo no catálogo (reabrir o picker, tag ainda aparece como opção disponível).

- [ ] **Step 9: Rodar a suíte E2E completa de novo**

Run: `npx playwright test`
Expected: todos os testes passam, incluindo os novos do Step 8.

- [ ] **Step 10: Lint e build**

Run: `npm run lint && npm run build`
Expected: ambos passam.

- [ ] **Step 11: Commit**

```bash
git add "src/app/[locale]/(app)/contacts/[id]/contact-tags.tsx" "src/app/[locale]/(app)/contacts/actions.ts" "src/app/[locale]/(app)/contacts/[id]/page.tsx" src/messages/pt-BR.json src/messages/en-US.json e2e/contacts.spec.ts
git commit -m "feat: picker de Tags no detalhe do Contato"
```
