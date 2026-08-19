import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/">Check<i>✓</i>Calling</Link><span className="muted">Secure host access</span></header>
    <section className="card" style={{maxWidth:520, margin:"70px auto"}}>
      <div className="eyebrow">Host portal</div>
      <h1 style={{fontSize:42}}>Sign in</h1>
      <p className="muted">Use the owner account you created in Supabase.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <form action={login} className="form">
        <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="button" type="submit">Sign in to Check Calling</button>
      </form>
    </section>
  </main>;
}

