import Link from "next/link";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import { HoursForm } from "./hours-form";
import "./hours.css";
import "./channel-options.css";
import "./copy-feedback.css";

export default async function BookingAndHoursPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const { data: step } = await supabase.from("organization_launch_steps").select("configuration,status")
    .eq("organization_id", membership.organization_id).eq("step_key", "rules").single();
  const configuration = (step?.configuration ?? {}) as { operatingHours?: Parameters<typeof HoursForm>[0]["settings"] };

  return <main className="hours-page">
    <header className="hours-top">
      <Link href="/launch?edit=1&step=rules" className="hours-brand">Check<i>✓</i>Calling</Link>
      <strong>Booking &amp; Business Hours</strong>
      <div className="hours-search">⌕ Search... <kbd>Ctrl K</kbd></div>
      <b className="hours-progress">2/8 setup · {step?.status?.replace("_", " ")}</b>
    </header>
    <div className="hours-workspace">
      <Link className="back-setup" href="/launch?edit=1&step=rules">← Back to setup</Link>
      <h1>Booking &amp; Business Hours</h1>
      <p className="page-intro">Choose how customers book, then set reservation options, pickup times, and return hours.</p>
      {params.saved && <div className="hours-success" role="status">Booking and business hours saved. Return to setup when you are ready to mark this step complete.</div>}
      {params.error && <div className="hours-error" role="alert">{params.error}</div>}
      <HoursForm settings={configuration.operatingHours ?? {}} />
    </div>
  </main>;
}
