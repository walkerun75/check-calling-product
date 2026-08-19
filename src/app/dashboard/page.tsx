import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members")
    .select("role, organizations(launch_status)").eq("user_id", user.id).limit(1).maybeSingle();
  const organization = membership?.organizations as unknown as { launch_status?: string } | null;
  if (["owner", "admin"].includes(membership?.role ?? "") && organization?.launch_status !== "active") redirect("/launch");
  redirect("/dashboard/command-center");
}
