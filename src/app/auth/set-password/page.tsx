import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setInvitedUserPassword } from "./actions";
import "./set-password.css";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Open your invitation email to create your account");
  return <main className="password-page"><div className="password-brand">Check<i>✓</i>Calling</div><section className="password-card"><div className="eyebrow">TEAM INVITATION</div><h1>Create your password</h1><p>Finish activating your Check Calling teammate account for <b>{user.email}</b>.</p>{params.error&&<div className="password-error" role="alert">{params.error}</div>}<form action={setInvitedUserPassword}><label>New password<input type="password" name="password" minLength={8} autoComplete="new-password" required/></label><label>Confirm password<input type="password" name="confirmation" minLength={8} autoComplete="new-password" required/></label><button>Create account</button></form></section></main>;
}
