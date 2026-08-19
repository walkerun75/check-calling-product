import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import PortalControls from "./portal-controls";
import ReadinessModal from "./readiness-modal";
import "./hero-frame.css";
import "./hero-alignment.css";

type Vehicle = { id:string; year:number|null; make:string|null; model:string|null; status:string; vin:string };
type Evaluation = { id:string; applicant_name:string; recommendation:string; confidence:number; missing_information:string[]; suggested_conditions:string[]; due_at:string|null };

export default async function CommandCenterPage() {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data:membership } = await supabase.from("organization_members").select("organization_id, role, organizations(name, launch_status)").eq("user_id",user.id).limit(1).maybeSingle();
  const memberOrganization = membership?.organizations as unknown as {name?:string;launch_status?:string} | null;
  if (["owner","admin"].includes(membership?.role ?? "") && memberOrganization?.launch_status !== "active") redirect("/launch");
  const { data } = membership?.organization_id ? await supabase.from("vehicles").select("id, year, make, model, status, vin").eq("organization_id",membership.organization_id).order("created_at") : { data:[] };
  const vehicles = (data ?? []) as Vehicle[];
  const { data:evaluationData } = membership?.organization_id ? await supabase.from("renter_evaluations").select("id,applicant_name,recommendation,confidence,missing_information,suggested_conditions,due_at").eq("organization_id",membership.organization_id).eq("status","waiting").order("created_at",{ascending:false}) : { data:[] };
  const evaluations = (evaluationData ?? []) as Evaluation[];
  const { data:launchStepData } = membership?.organization_id ? await supabase.from("organization_launch_steps").select("step_key,status").eq("organization_id",membership.organization_id) : { data:[] };
  const launchSteps = (launchStepData ?? []) as {step_key:string;status:string}[];
  const completedLaunchSteps = launchSteps.filter(step=>step.status==="complete").length;
  const counts = vehicles.reduce<Record<string,number>>((sum,vehicle)=>{sum[vehicle.status]=(sum[vehicle.status]??0)+1;return sum;},{});
  const attention = vehicles.filter(vehicle=>vehicle.status !== "ready" && vehicle.status !== "rented");
  const ready = counts.ready ?? 0;
  const operational = vehicles.length > 0 && attention.length === 0;
  const organizationName = memberOrganization?.name ?? "Check Calling";
  const briefingTitle = evaluations.length ? `${evaluations.length} renter evaluation${evaluations.length===1?" needs":"s need"} review.` : operational ? "Fleet records are ready." : "Fleet action is required.";
  const briefingText = evaluations.length ? `${evaluations.filter(item=>item.recommendation==="approve_with_conditions").length} recommended with conditions · ${evaluations.filter(item=>item.recommendation==="manual_review").length} require manual review.` : operational ? `${ready} vehicle${ready===1?" is":"s are"} ready. Rentals is the next production workflow to connect.` : `${attention.length} vehicle record${attention.length===1?" needs":"s need"} attention before downstream rental automation.`;
  return <div><PortalControls/><div className="portal-main"><main className="shell command-page">
    <header className="topbar"><div><div className="brand">Check<i>✓</i>Calling</div><span className="muted">{organizationName}</span></div><nav className="nav">{["owner","admin"].includes(membership?.role ?? "")&&<Link className="button secondary" href="/launch?edit=1">Business setup</Link>}<form action={logout}><button className="button secondary">Sign out</button></form></nav></header>
    <section className="command-hero-frame" aria-label="Operations command hero">
    <section className="briefing"><span className="briefing-icon">✦</span><div><div className="eyebrow">AI daily briefing</div><h2>{briefingTitle}</h2><p>{briefingText}</p>{evaluations.length>0&&<Link className="button" href="/dashboard/decisions">Review renter decisions</Link>}</div></section>
    <div className="grid">
      <section className="card"><div className="eyebrow">System readiness</div><div className="metric">{operational ? "Operational" : attention.length ? "Attention" : "Starting"}</div><span className="muted">Fleet is live · 5 workflow systems awaiting connection</span></section>
      <section className="card"><div className="eyebrow">Fleet snapshot</div><div className="two"><div><div className="metric">{vehicles.length}</div><span className="muted">Total vehicles</span></div><div><div className="metric">{ready}</div><span className="muted">Ready</span></div></div></section>
    </div>
    <div className="radar-layout">
      <section className="card radar" aria-label="Operations system radar">
        <div className="eyebrow">Connected operating stack</div><h2>Automation control radar</h2>
        <div className="radar-map"><div className="rings" aria-hidden="true"/><div className="radar-sweep" aria-hidden="true"/>
          <ReadinessModal vehicleCount={vehicles.length} readyCount={ready} attentionCount={attention.length} launchSteps={launchSteps}/>
          <Link className="radar-node live node-fleet" href="/dashboard/vehicle-intelligence" aria-label="Open Vehicle Intelligence"><span className="node-icon">🚙</span><span><strong>Fleet · {vehicles.length}</strong><small>{ready} ready · {attention.length} attention</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
          <Link className="radar-node node-rentals" href="/launch/hours" aria-label="Open Booking and Business Hours setup"><span className="node-icon">▦</span><span><strong>Rentals · 0</strong><small>No production records</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
          <Link className="radar-node node-finance" href="/launch/payments" aria-label="Open Finance setup"><span className="node-icon">$</span><span><strong>Finance · 0</strong><small>Payments not connected</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
          <Link className="radar-node node-assessments" href="/dashboard/decisions" aria-label="Open Renter Assessments"><span className="node-icon">✓</span><span><strong>Assessments · 0</strong><small>Applications not connected</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
          <Link className="radar-node node-agreements" href="/launch/agreements" aria-label="Open Agreements setup"><span className="node-icon">▤</span><span><strong>Agreements · 0</strong><small>Documents not connected</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
          <Link className="radar-node node-website" href="/launch/website" aria-label="Open Website and Booking setup"><span className="node-icon">◎</span><span><strong>Website · 0</strong><small>Booking engine not connected</small></span><span className="node-arrow" aria-hidden="true">›</span></Link>
        </div>
        <div className="radar-readings"><div><span>Setup complete</span><strong>{completedLaunchSteps} / 8</strong></div><div><span>Network</span><strong className="online">Live</strong></div><div><span>Fleet alerts</span><strong>{attention.length}</strong></div></div>
      </section>
      <aside className="card"><div className="eyebrow">The objective of Check Calling</div><h2>Run the rental business by exception—not by chasing every routine task.</h2><p className="muted">Fleet records, rentals, agreements, payments, assessments, calendar activity, and the website will advance from one shared operating record.</p><div className="objective-list"><div className="objective-item"><span className="objective-check">✓</span><span><strong>See what needs attention now</strong><small>Real database conditions produce the priority queue.</small></span></div><div className="objective-item"><span className="objective-check">✓</span><span><strong>Automate routine rental steps</strong><small>Each new connected workflow will advance from verified records.</small></span></div><div className="objective-item"><span className="objective-check">✓</span><span><strong>Keep vehicles rental-ready</strong><small>Fleet status remains visible before a booking is accepted.</small></span></div></div></aside>
    </div>
    <section className="kpi-row"><div className="kpi-card"><span>Vehicles available</span><strong>{ready}</strong><small>Live Fleet data</small></div><div className="kpi-card"><span>Rentals active</span><strong>—</strong><small>Not connected</small></div><div className="kpi-card"><span>Pickups today</span><strong>—</strong><small>Not connected</small></div><div className="kpi-card"><span>Returns today</span><strong>—</strong><small>Not connected</small></div><div className="kpi-card"><span>Needs attention</span><strong>{attention.length}</strong><small>Live Fleet data</small></div></section>
    </section>
    <section className="operations-alert-section" id="operations-alerts" tabIndex={-1} aria-labelledby="operations-alert-title">
      <header className="operations-alert-header"><div><div className="eyebrow">Live operational alerts</div><h2 id="operations-alert-title">What needs your attention</h2><p>Review fleet exceptions and renter decisions generated from verified records.</p></div><span className={`alert-count-badge ${attention.length+evaluations.length===0 ? "clear" : ""}`}>{attention.length+evaluations.length===0 ? "All clear" : `${attention.length+evaluations.length} active`}</span></header>
      <div className="workspace-grid alert-workspace"><div className="card"><div className="eyebrow">Host action queue</div><h2>What needs your decision</h2><div className="queue">{evaluations.map(item=><div className="queue-item high" key={item.id}><h3>Renter evaluation · {item.applicant_name}</h3><p>{item.recommendation.replaceAll("_"," ")} · {Math.round(item.confidence)}% confidence{item.missing_information.length?` · Missing: ${item.missing_information.join(", ")}`:""}</p><div className="actions"><Link className="button" href={`/dashboard/decisions?evaluation=${item.id}`}>Review evaluation</Link></div></div>)}{attention.map(vehicle=><div className="queue-item high" key={vehicle.id}><h3>{vehicle.year} {vehicle.make} {vehicle.model}</h3><p>Status is {vehicle.status}. Complete the readiness record.</p><div className="actions"><Link className="button" href={`/dashboard/fleet/${vehicle.id}`}>Open vehicle</Link></div></div>)}{attention.length===0&&evaluations.length===0&&<div className="queue-item good"><h3>No host decisions waiting</h3><p>Fleet records are ready and there are no renter recommendations requiring review.</p></div>}<div className="queue-item"><h3>Next system: Rentals</h3><p>Rental actions will populate here after the Rentals workflow is connected.</p></div></div></div><aside className="card"><div className="eyebrow">Next scheduled activity</div><h2>Calendar awaiting connection</h2><div className="empty-workspace">Pickup, return, cleaning, and maintenance activity will appear here from real rental records.</div></aside></div>
    </section>
    <section className="fleet-summary-row" aria-label="Fleet status summary"><div className="fleet-summary-card"><span>Available</span><strong>{ready}</strong><small>Verified ready vehicles</small></div><div className="fleet-summary-card"><span>Rented</span><strong>{counts.rented ?? 0}</strong><small>Live fleet records</small></div><div className="fleet-summary-card warning"><span>Maintenance</span><strong>{counts.maintenance ?? 0}</strong><small>Service status</small></div></section>
    <section className="investment-strip"><div><span>Fleet this month</span><strong>Awaiting finance</strong></div><div><span>Utilization</span><strong>—</strong></div><div><span>Rentals</span><strong>—</strong></div><span className="connection-chip">Finance connection required</span></section>
    <section className="workspace-grid priority-workspace"><div className="card"><div className="section-title-row"><div><div className="eyebrow">AI operations</div><h2>Priority Queue</h2></div><span className="queue-total">{attention.length+evaluations.length} active</span></div><div className="priority-card-grid">{attention.map(vehicle=><article className="priority-card critical" key={`priority-${vehicle.id}`}><span className="priority-type">Fleet alert</span><h3>{vehicle.year} {vehicle.make} {vehicle.model}</h3><p>Status is {vehicle.status}. Complete this vehicle’s readiness record before it enters a rental workflow.</p><Link className="button" href={`/dashboard/fleet/${vehicle.id}`}>Open vehicle</Link></article>)}{evaluations.map(item=><article className="priority-card review" key={`priority-${item.id}`}><span className="priority-type">Renter decision</span><h3>{item.applicant_name}</h3><p>{item.recommendation.replaceAll("_"," ")} · {Math.round(item.confidence)}% confidence</p><Link className="button" href={`/dashboard/decisions?evaluation=${item.id}`}>Review evaluation</Link></article>)}{attention.length===0&&evaluations.length===0&&<article className="priority-card clear"><span className="priority-type">All clear</span><h3>No active priorities</h3><p>New verified exceptions will appear here automatically.</p></article>}</div></div><aside className="card investment-panel"><div className="eyebrow">Fleet investment</div><h2>Finance awaiting connection</h2><div className="investment-meter"><i style={{width:"0%"}}/></div><dl><div><dt>Total invested</dt><dd>—</dd></div><div><dt>Cash generated</dt><dd>—</dd></div><div><dt>Closest to payoff</dt><dd>—</dd></div></dl><div className="empty-workspace">Connect verified financial records to calculate recovery and utilization.</div></aside></section>
    <section className="pickup-return-grid"><div className="schedule-panel pickup"><div className="eyebrow">Pickups</div><h2>Today (0)</h2><p>No vehicle pickups scheduled.</p><h3>Tomorrow (0)</h3><p>Rental schedule not connected.</p></div><div className="schedule-panel return"><div className="eyebrow">Returns</div><h2>Today (0)</h2><p>No vehicle returns scheduled.</p><h3>Tomorrow (0)</h3><p>Rental schedule not connected.</p></div></section>
    <section className="card smart-calendar-panel"><div className="section-title-row"><div><div className="eyebrow">Live operations</div><h2>7-Day Smart Calendar</h2><p>Bookings, maintenance, readiness, and revenue opportunities in one timeline.</p></div><span className="connection-chip">Calendar awaiting connection</span></div><div className="calendar-week">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day,index)=><div key={day}><strong>{day}</strong><span>Day {index+1}</span></div>)}</div><div className="calendar-empty-state"><strong>Rental schedule not connected</strong><span>Verified bookings and operational events will populate this timeline automatically.</span></div></section>
    <footer className="command-footer"><strong>Check✓Calling operations command platform</strong><span>Supabase connected · Fleet workflow live · Production workspace</span></footer>
  </main></div>
  <aside className="side-menu" id="operations-sidebar" aria-label="Portal navigation">
    <div className="side-logo">Check<i>✓</i>Calling</div>
    <div className="side-status"><span className="avatar">O</span><div><strong>Operations Live</strong><small>Fleet connected · {vehicles.length} vehicle{vehicles.length===1?"":"s"}</small></div></div>
    <nav className="side-nav">
      <Link className="side-link active" href="/dashboard/command-center"><span>▦</span>Command Center<em>LIVE</em></Link>
      <Link className="side-link" href="/dashboard/smart-calendar"><span>▣</span>Smart Calendar<em>AI</em></Link>
      <Link className="side-link" href="/dashboard/fleet-workshop?from=command"><span>▤</span>Porter Operations<em>LIVE</em></Link>
      <Link className="side-link" href="/dashboard/vehicle-intelligence"><span>🚙</span>Vehicle Intelligence<em>LIVE</em></Link>
      <span className="side-link disabled" aria-disabled="true"><span>◎</span>Website<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>◇</span>Marketing<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>✓</span>Check Callin<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>$</span>Finance<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>✉</span>Messages<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>□</span>Integrations<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>⚙</span>Settings<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>▤</span>Agreements<em>SOON</em></span>
      <span className="side-link disabled" aria-disabled="true"><span>▥</span>Insights<em>SOON</em></span>
    </nav>
    <div className="host-card"><span className="avatar">R</span><div><strong>Ronald Walker</strong><small>Owner account</small></div></div>
  </aside></div>;
}
