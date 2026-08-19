import Link from "next/link";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import { activatePlatform, updateLaunchStep } from "./actions";
import ThemeToggle from "./theme-toggle";
import "./launch.css";
import "./launch-demo-theme.css";
import "./launch-progress.css";
import "./launch-navigation.css";
import "./launch-back-button.css";
import "./launch-completed.css";
import "./launch-operations-match.css";
import "./launch-reference-theme.css";
import "./launch-dark-blue.css";
import "./launch-navy-army.css";
import "./launch-cloned-operations-theme.css";
import "./launch-readable.css";
import "./launch-theme-toggle.css";

const definitions = [
  ["business","Team","Team Setup","Invite team members and assign the exact portal permissions needed for each employee."],
  ["rules","Booking & Business Hours","Booking & Business Hours","Choose how customers book, then configure reservation rules, pickup times, and return hours."],
  ["fleet","Fleet Setup","Fleet Setup","Add verified vehicles, pricing, availability, photos, and readiness records."],
  ["approval","Renter Evaluation","Renter Evaluation","Define approval requirements, recommendation factors, confidence thresholds, and host review controls."],
  ["payments","Payments, Taxes & Protection","Payments, Taxes & Protection","Configure payment processing, tax profiles, deposits, payouts, protection, and financial safeguards."],
  ["agreements","Agreements & Automation","Agreements & Automation","Configure e-signature documents, delivery, reminders, and workflow rules."],
  ["website","Website & Booking Engine","Website & Booking Engine","Connect the catalog, checkout, domain, availability, and direct booking flow."],
  ["launch","Launch Check","Launch Check","Verify permissions, connected records, workflows, and production readiness before activation."],
] as const;

export default async function LaunchPage({searchParams}:{searchParams:Promise<{step?:string;error?:string;completed?:string;edit?:string;mode?:string}>}) {
  const params = await searchParams;
  const {supabase,membership} = await getLaunchContext();
  if (!["owner","admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const org = membership.organizations as unknown as {name:string;launch_status:string};
  if (org.launch_status === "active" && params.edit !== "1" && !params.step) redirect("/dashboard/command-center");
  await supabase.from("organization_launch_steps").upsert(
    definitions.map((item,index) => ({ organization_id:membership.organization_id, step_key:item[0], position:index+1 })),
    { onConflict:"organization_id,step_key", ignoreDuplicates:true },
  );
  const {data:rows} = await supabase.from("organization_launch_steps").select("step_key,status,position").eq("organization_id",membership.organization_id).order("position");
  const statusMap = new Map((rows ?? []).map(row => [row.step_key,row.status]));
  const completedDefinitions = definitions.filter(item => statusMap.get(item[0]) === "complete");
  const completed = completedDefinitions.length;
  const current = definitions.find(item => item[0] === params.step) ?? definitions[0];
  const currentIndex = definitions.indexOf(current);
  const previous = currentIndex > 0 ? definitions[currentIndex - 1] : null;
  const currentIsComplete = statusMap.get(current[0]) === "complete";
  const justCompleted = definitions.find(item => item[0] === params.completed);
  const percent = Math.round(completed / 8 * 100);
  const vehicles = await supabase.from("vehicles").select("id",{count:"exact",head:true}).eq("organization_id",membership.organization_id);

  return <main className="launch-page" style={{paddingRight:17}}>
    <header className="launch-top" style={{right:0}}><div className="brand">Check<i>✓</i>Calling</div><div className="launch-top-progress"><strong>○ {completed}/8 completed</strong><ThemeToggle/></div></header>
    <section className="launch-hero"><div><div className="eyebrow">● Check Calling command center</div><h1>Rental Operations</h1><p>Manage your fleet, bookings, renters, payments, agreements, website, and remote handoffs from one command center.</p></div>
      <div className="launch-progress"><div><span>{completed} of 8 complete</span><b>{percent}%</b></div><div className="launch-track"><i style={{width:`${percent}%`}}/></div><div className="launch-flags">{completedDefinitions.length?completedDefinitions.slice(-3).map(item=><small key={item[0]}>✓ {item[1]}</small>):<small>● Setup not started</small>}</div>{justCompleted&&<p className="launch-complete-note"><b>{justCompleted[1]} complete.</b> {justCompleted[3]}</p>}</div>
    </section>
    {params.error&&<div className="launch-error">{params.error}</div>}
    <section className="launch-workspace">
      <aside className="launch-steps"><div className="eyebrow">Platform launch sequence</div>{definitions.map((item,index)=>{const status=statusMap.get(item[0])??"not_started";return <Link key={item[0]} href={`/launch?step=${item[0]}`} className={`launch-step ${current[0]===item[0]?"active":""} ${status}`}><span>{status==="complete"?"✓":index+1}</span><div><b>{item[1]}</b><small>{status.replace("_"," ")}</small></div><em>›</em></Link>})}<form action={activatePlatform} className="launch-activate"><small>Final activation</small><button disabled={completed!==8}>Activate Check Calling</button></form></aside>
      <article className="launch-operation"><div className="operation-signal"><span>Current operation</span><b>● Signal stable</b></div><div className="launch-step-nav"><div className="launch-back-actions"><Link className="back-to-business" href="/launch?edit=1&step=business">← Back to Team Setup</Link>{previous&&<Link href={`/launch?edit=1&step=${previous[0]}`}>Previous: {previous[1]}</Link>}</div><span className="step-chip">Step {currentIndex+1} of 8</span></div><h2>{current[2]}</h2><h3>{current[1]}</h3>{currentIsComplete&&<div className="completed-edit-banner">✓ Complete · Select Edit to reopen this setup. You must mark it complete again after making changes.</div>}<p>{current[3]}</p><div className="launch-actions"><form action={updateLaunchStep}><input type="hidden" name="stepKey" value={current[0]}/><input type="hidden" name="intent" value={currentIsComplete?"edit":"start"}/><button className="button">{currentIsComplete?`Edit ${current[1]}`:current[0]==="business"?"Invite team members":current[0]==="rules"?"Set business hours":`Start ${current[1].toLowerCase()}`}</button></form><form action={updateLaunchStep}><input type="hidden" name="stepKey" value={current[0]}/><input type="hidden" name="intent" value="complete"/><button className="button secondary" disabled={currentIsComplete}>{currentIsComplete?"✓ Completed":"Mark complete"}</button></form></div>{params.mode==="edit"&&<p className="editing-status">Editing mode is open. This step is now In Progress and must be marked complete again.</p>}<button type="button" className="launch-help">↗ Visit help center</button><div className="launch-note"><b>Production framework</b><p>Each connected page will save its own verified configuration here. Completion is persistent and shared with authorized admins.</p></div></article>
      <aside className="launch-network"><div className="launch-network-title"><div><div className="eyebrow">Check Calling operating stack</div><h3>Host network</h3></div><span>Live</span></div><div className={`mini-radar ${completed===8?"all-complete":""}`}><i/><div className="radar-progress" aria-label={`${completed} of 8 setup steps complete`}><strong>{completed===8?"✓":completed}</strong><span>{completed===8?"System":"of 8"}</span><small>{completed===8?"Ready":"Complete"}</small></div><div className="mini-node docs">Documents<small>Agreement needed</small></div><div className="mini-node host">Host<small>{vehicles.count??0} vehicle active</small></div><div className="mini-node booking">Bookings<small>{completed>1?"Connected":"Connect"}</small></div><div className="mini-node renters">Renters<small>{completed>3?"Ready":"Setup"}</small></div><div className="mini-node payments">Payments<small>{completed>4?"Ready":"Setup due"}</small></div><div className="mini-node web">Website<small>{completed>6?"Connected":"Not launched"}</small></div></div><div className="network-stats"><div><small>Systems active</small><b>{completed.toString().padStart(2,"0")}</b></div><div><small>Network</small><b>{completed===8?"Ready":completed?"Attention":"Setup"}</b></div><div><small>Alerts</small><b>{8-completed}</b></div></div></aside>
    </section>
    <section className="launch-preview-row"><div><small>Available</small><b>{vehicles.count??0}</b></div><div><small>Rented</small><b>0</b></div><div><small>Maintenance</small><b>0</b></div></section>
  </main>;
}
