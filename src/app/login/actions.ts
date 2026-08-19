"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  const { data: membership } = await supabase.from("organization_members")
    .select("role, organizations(launch_status)").eq("user_id", (await supabase.auth.getUser()).data.user!.id)
    .limit(1).maybeSingle();
  const org = membership?.organizations as unknown as {launch_status?:string} | null;
  if (["owner","admin"].includes(membership?.role ?? "") && org?.launch_status !== "active") redirect("/launch");
  redirect("/dashboard/command-center");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
