"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { saveFilter, deleteFilter, type SaveFilterState } from "@/lib/actions/saved-filters";

const initialSaveState: SaveFilterState = { error: null };

type SavedFilterRow<TFilterState> = {
  id: string;
  name: string;
  filter_state: TFilterState;
};

// Form de "salvar filtro" isolado num componente próprio — permite dar bind
// no saveFilter com o par (entityType, currentFilterState) atual e, via
// useActionState, mostrar o erro certo (nome obrigatório/duplicado/genérico)
// sem misturar esse estado com o resto do controle (Select de aplicar,
// lista de apagar).
function SaveFilterForm<TFilterState extends Record<string, string | undefined>>({
  entityType,
  currentFilterState,
  onSaved,
}: {
  entityType: "contact" | "organization";
  currentFilterState: TFilterState;
  onSaved: () => void;
}) {
  const t = useTranslations("SavedFilters");
  const action = saveFilter.bind(null, entityType, currentFilterState);
  const [state, formAction, isPending] = useActionState(action, initialSaveState);

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const errorMessage =
    state.error === "required_name"
      ? t("nameFieldRequired")
      : state.error === "duplicate_name"
        ? t("nameFieldDuplicate")
        : state.error === "generic"
          ? t("saveError")
          : undefined;

  return (
    <SheetContent>
      <form action={formAction} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>{t("saveDialogTitle")}</SheetTitle>
          <SheetDescription>{t("saveDialogDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("nameLabel")}</FieldLabel>
              <Input id="name" name="name" required />
            </Field>
            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </FieldGroup>
        </div>
        <SheetFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("saving") : t("saveConfirm")}
          </Button>
          <SheetClose render={<Button type="button" variant="outline" />}>
            {t("cancel")}
          </SheetClose>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}

// Entity-agnostic de propósito — Task 3 (Contatos) importa este componente e
// os dois Server Actions (saveFilter/deleteFilter) sem modificá-los, só
// trocando entityType/currentFilterState/onApply. Nenhuma lógica específica
// de Organização (ou Contato) pode entrar aqui.
export function SavedFiltersControl<TFilterState extends Record<string, string | undefined>>({
  entityType,
  savedFilters,
  currentFilterState,
  onApply,
}: {
  entityType: "contact" | "organization";
  savedFilters: SavedFilterRow<TFilterState>[];
  currentFilterState: TFilterState;
  onApply: (filterState: TFilterState) => void;
}) {
  const t = useTranslations("SavedFilters");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Nonce: forçar o Select de "aplicar" a remontar sem valor selecionado
  // depois de cada escolha — mais simples que controlar value/onValueChange
  // só pra sempre resetar pra null, e evita o Select ficar "preso" mostrando
  // o nome escolhido (currentFilterState muda depois via outros dropdowns,
  // sem relação com o que está selecionado aqui).
  const [applyKey, setApplyKey] = useState(0);

  function openSave() {
    setFormKey((key) => key + 1);
    setSheetOpen(true);
  }

  function handleApply(value: unknown) {
    if (typeof value !== "string") return;
    const found = savedFilters.find((item) => item.id === value);
    if (found) onApply(found.filter_state);
    setApplyKey((key) => key + 1);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const { error } = await deleteFilter(id);
    if (error) window.alert(t("deleteError"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select key={applyKey} onValueChange={handleApply}>
        <SelectTrigger id="saved-filters-apply" aria-label={t("title")} className="w-48">
          <SelectValue placeholder={t("selectPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {savedFilters.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="outline" size="sm" onClick={openSave}>
        <PlusIcon aria-hidden="true" />
        {t("saveButton")}
      </Button>

      {savedFilters.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {savedFilters.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"
            >
              <span>{item.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("deleteButtonLabel")}
                onClick={() => handleDelete(item.id)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SaveFilterForm
          key={formKey}
          entityType={entityType}
          currentFilterState={currentFilterState}
          onSaved={() => setSheetOpen(false)}
        />
      </Sheet>
    </div>
  );
}
