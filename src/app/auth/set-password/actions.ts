"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setInvitedUserPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) redirect("/auth/set-password?error=Password must be at least 8 characters");
  if (password !== confirmation) redirect("/auth/set-password?error=Passwords do not match");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Open the invitation link again to continue");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/auth/set-password?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
