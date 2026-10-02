"use server";

import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginState = {
  error: "invalid_email" | "required_password" | "invalid_credentials" | "generic" | null;
};

export async function login(
  locale: string,
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.email) return { error: "invalid_email" };
    if (fieldErrors.password) return { error: "required_password" };
    return { error: "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "invalid_credentials") {
      return { error: "invalid_credentials" };
    }
    return { error: "generic" };
  }

  redirect({ href: "/dashboard", locale });
  return { error: null };
}

export async function logout(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale });
}
