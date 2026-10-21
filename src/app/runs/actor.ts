import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Actor } from "@/lib/runs/rules";

// Поточний користувач і його роль — з profiles.role (ніколи з user_metadata).
// getClaims() перевіряє JWT; getSession() для авторизації на сервері не використовуємо.
export async function requireActor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  const role = profile?.role;
  const actor: Actor | null =
    role === "manager" || role === "admin" ? { id: claims.sub, role } : null;

  return { supabase, actor, email: profile?.email ?? claims.email ?? null };
}
