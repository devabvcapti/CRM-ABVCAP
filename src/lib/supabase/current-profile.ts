import { createClient } from "./server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_id", user.id)
    .maybeSingle();

  return data;
}
