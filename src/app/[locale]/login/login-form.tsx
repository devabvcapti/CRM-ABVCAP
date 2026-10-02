"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("LoginPage");
  const [state, formAction, isPending] = useActionState(
    login.bind(null, locale),
    initialState,
  );

  const errorMessage =
    state.error === "invalid_email"
      ? t("errorInvalidEmail")
      : state.error === "required_password"
        ? t("errorRequiredPassword")
        : state.error === "invalid_credentials"
          ? t("errorInvalidCredentials")
          : state.error === "generic"
            ? t("errorGeneric")
            : undefined;

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        {errorMessage && <FieldError>{errorMessage}</FieldError>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
