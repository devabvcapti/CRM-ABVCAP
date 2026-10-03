"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { addTagToContact, removeTagFromContact } from "../actions";

type TagOption = { id: string; name: string };

// Sentinel só pra escolher o rótulo certo do item (texto normal vs
// `tagsCreateOption`) — a chamada de addTagToContact usa sempre `option.name`
// dos dois jeitos (tag real OU texto digitado), nunca este id: o upsert por
// nome em addTagToContact já resolve "criar" e "anexar existente" com a
// mesma chamada (ver actions.ts).
const CREATE_TAG_ID = "__create_tag__";

// Picker que abre inline no lugar do próprio botão "Adicionar tag" (sem
// Sheet/Dialog — é uma lista de escolha rápida, não um formulário) e se
// fecha sozinho via onOpenChange assim que uma tag é selecionada ou o
// usuário desiste (clique fora / Esc) — nesse ponto `onDone` devolve o
// controle pro pai, que desmonta este componente e volta a mostrar o botão.
function TagAddPicker({
  contactId,
  options,
  attachedTagNames,
  onDone,
}: {
  contactId: string;
  options: TagOption[];
  attachedTagNames: string[];
  onDone: () => void;
}) {
  const t = useTranslations("ContactTags");
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();

  // Fix de follow-up (achado do controller ao rodar a suíte E2E completa
  // após a primeira rodada de fixes): tanto a lista de matches por SUBSTRING
  // quanto os dois checks de match EXATO abaixo usam `trimmedQuery`/
  // `normalizedQuery` (nunca o `query` cru) — espaços nas pontas nunca podem
  // fazer um nome que de fato bate (substring OU exato) deixar de aparecer
  // na lista. Antes, `matches` filtrava com o `query` cru: digitar o nome de
  // uma tag existente com espaços extras nas pontas (Review Focus "não
  // duplica por nome com espaços") fazia `"nome".includes("  nome  ")` ser
  // sempre `false` (a string com padding é mais longa que o nome real, nunca
  // pode ser substring dele) — `matches` ficava vazio e, como o check de
  // match exato (abaixo) corretamente já suprimia "Criar tag" nesse caso, o
  // picker não sobrava com NENHUMA opção clicável: nem a tag existente, nem
  // "criar".
  const matches = trimmedQuery
    ? options.filter((option) => option.name.toLowerCase().includes(normalizedQuery))
    : options;

  // A opção "Criar tag" precisa aparecer sempre que o texto digitado
  // (trimmed) não é vazio E não é uma cópia EXATA (case-insensitive) do nome
  // de alguma tag já disponível para anexar OU já anexada a este contato —
  // independente de quantos matches por SUBSTRING também aparecem na lista
  // (a opção de criar é aditiva, nunca exclusiva com os matches). Antes,
  // "Criar tag" só aparecia quando `matches` estava vazio, então digitar
  // "Conselheiro" com uma tag "Conselheiro Fiscal" já existente no catálogo
  // escondia a opção de criar "Conselheiro" (não há outra forma de criar tag
  // no app). E, sem o check contra `attachedTagNames`, redigitar o nome
  // EXATO de uma tag já anexada a este contato (que `options` já exclui)
  // ainda oferecia "criar" — a tentativa batia direto na constraint
  // `entity_tags_unique` e virava um alerta genérico em vez de simplesmente
  // não oferecer a opção.
  const hasExactAvailableOption = options.some(
    (option) => option.name.toLowerCase() === normalizedQuery,
  );
  const hasExactAttachedTag = attachedTagNames.some(
    (name) => name.toLowerCase() === normalizedQuery,
  );
  const showCreateOption = trimmedQuery !== "" && !hasExactAvailableOption && !hasExactAttachedTag;

  const items: TagOption[] = showCreateOption
    ? [...matches, { id: CREATE_TAG_ID, name: trimmedQuery }]
    : matches;

  async function handleSelect(item: TagOption | null) {
    if (!item) return;
    const { error } = await addTagToContact(contactId, item.name);
    if (error) window.alert(t("tagsError"));
  }

  return (
    <Combobox<TagOption>
      items={items}
      itemToStringLabel={(option) => option.name}
      defaultOpen
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      onInputValueChange={setQuery}
      onValueChange={handleSelect}
    >
      <ComboboxInput autoFocus placeholder={t("tagsSearchPlaceholder")} showTrigger={false} />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(option: TagOption) => (
              <ComboboxItem key={option.id} value={option}>
                {option.id === CREATE_TAG_ID
                  ? t("tagsCreateOption", { query: option.name })
                  : option.name}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function ContactTags({
  contactId,
  tags,
  allTags,
}: {
  contactId: string;
  tags: { entityTagId: string; tagId: string; name: string }[];
  allTags: { id: string; name: string }[];
}) {
  const t = useTranslations("ContactTags");
  const [isAdding, setIsAdding] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  // Review Focus: nunca oferecer no picker uma tag já anexada a este
  // contato (evitaria duplicar a linha em entity_tags).
  const availableOptions = allTags.filter(
    (option) => !tags.some((attached) => attached.tagId === option.id),
  );

  function openPicker() {
    setPickerKey((key) => key + 1);
    setIsAdding(true);
  }

  async function handleRemove(entityTagId: string) {
    const { error } = await removeTagFromContact(entityTagId);
    if (error) window.alert(t("tagsError"));
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">{t("tagsTitle")}</h3>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tagsEmpty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.entityTagId}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {tag.name}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("tagsRemoveLabel", { name: tag.name })}
                  onClick={() => handleRemove(tag.entityTagId)}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <TagAddPicker
          key={pickerKey}
          contactId={contactId}
          options={availableOptions}
          attachedTagNames={tags.map((tag) => tag.name)}
          onDone={() => setIsAdding(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={openPicker} className="self-start">
          <PlusIcon aria-hidden="true" />
          {t("tagsAddButton")}
        </Button>
      )}
    </div>
  );
}
