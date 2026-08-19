import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getLaunchContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members")
    .select("organization_id, role, organizations(name, launch_status)")
    .eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/login?error=No organization membership found");
  return { supabase, user, membership };
}
