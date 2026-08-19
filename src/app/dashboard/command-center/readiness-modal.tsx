"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type LaunchStep = { step_key:string; status:string };
type Props = { vehicleCount:number; readyCount:number; attentionCount:number; launchSteps:LaunchStep[] };

export default function ReadinessModal({ vehicleCount, readyCount, attentionCount, launchSteps }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const status = useMemo(() => new Map(launchSteps.map(step => [step.step_key,step.status])), [launchSteps]);
  const items = useMemo(() => [
    { key:"business", name:"Team", detail:"Team members and portal permissions" },
    { key:"rules", name:"Booking & Business Hours", detail:"Booking, pickup, return, and cancellation rules" },
    { key:"fleet", name:"Fleet Setup", detail:`${vehicleCount} vehicle${vehicleCount===1?"":"s"} · ${readyCount} ready · ${attentionCount} attention` },
    { key:"approval", name:"Renter Evaluation", detail:"Application and verification workflow" },
    { key:"payments", name:"Payments, Taxes & Protection", detail:"Charges, deposits, taxes, and safeguards" },
    { key:"agreements", name:"Agreements & Automation", detail:"Documents and workflow rules" },
    { key:"website", name:"Website & Booking Engine", detail:"Catalog, checkout, and domain" },
    { key:"launch", name:"Launch Check", detail:"Production readiness verification" },
  ].map(item => ({...item,ready:status.get(item.key)==="complete",href:`/launch?edit=1&step=${item.key}`})), [attentionCount, readyCount, status, vehicleCount]);
  const complete = items.filter(item => item.ready).length;
  const allComplete = complete === 8;
  const hasAlerts = attentionCount > 0;
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    function onKeyDown(event:KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  function handleCenterAction() {
    if (hasAlerts) {
      const alertSection = document.getElementById("operations-alerts");
      alertSection?.scrollIntoView({ behavior:"smooth", block:"start" });
      window.setTimeout(() => alertSection?.focus({ preventScroll:true }), 450);
      return;
    }
    setOpen(true);
  }
  return <>
    <button className={`radar-center ${hasAlerts ? "radar-center-alert" : allComplete ? "radar-center-complete" : ""}`} type="button" onClick={handleCenterAction} aria-haspopup={hasAlerts ? undefined : "dialog"} aria-label={hasAlerts ? `Review ${attentionCount} active fleet alert${attentionCount===1?"":"s"}` : `Open system readiness, ${complete} of 8 complete`}>
      {hasAlerts
        ? <span className="radar-alert-content"><span className="radar-alert-icon" aria-hidden="true">!</span><strong>{attentionCount}</strong><small>{attentionCount===1?"Alert":"Alerts"}</small><span className="radar-alert-action">Review <i aria-hidden="true">›</i></span></span>
        : allComplete
        ? <span className="radar-complete-check" aria-hidden="true">✓</span>
        : <span className="radar-center-content"><strong>{complete}<em>/8</em></strong><small>Readiness</small><span className="radar-center-action">View setup <i aria-hidden="true">›</i></span></span>}
    </button>
    {open && mounted && createPortal(<div className="readiness-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="readiness-dialog" role="dialog" aria-modal="true" aria-labelledby="readiness-title">
        <header><div><div className="eyebrow">Platform configuration</div><h2 id="readiness-title">System Readiness · {complete}/8</h2><p>Your production connections and launch requirements.</p></div><button className="readiness-close" type="button" onClick={() => setOpen(false)} aria-label="Close system readiness">×</button></header>
        <div className="readiness-grid">{items.map(item => {
          const content = <><span className={`readiness-check ${item.ready ? "ready" : "pending"}`}>{item.ready ? "✓" : "!"}</span><span><strong>{item.name}</strong><small>{item.detail}</small></span><em>{item.ready ? "Ready" : "Setup required"}</em></>;
          return item.href ? <Link className="readiness-item" href={item.href} key={item.name} onClick={() => setOpen(false)}>{content}</Link> : <div className="readiness-item" key={item.name}>{content}</div>;
        })}</div>
      </section>
    </div>, document.body)}
  </>;
}
