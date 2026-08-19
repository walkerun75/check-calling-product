"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IntelligenceVehicle } from "./page";

type Economics = { purchase: string; monthly: string; expenses: string };
type Panel = "economics" | "telematics" | null;
type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechErrorEvent = { error: string };
type SpeechRecognitionInstance = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; abort: () => void; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: SpeechErrorEvent) => void) | null; onend: (() => void) | null };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
export type FleetFinancialEntry = { vehicle_id: string | null; entry_date: string; category: "rental_income" | "maintenance" | "repair" | "vehicle_investment"; amount: number };

const readyStatuses = new Set(["ready", "rented"]);

export default function VehicleIntelligenceClient({ vehicles, organizationName, financialEntries }: { vehicles: IntelligenceVehicle[]; organizationName: string; financialEntries: FleetFinancialEntry[] }) {
  const [selected, setSelected] = useState(vehicles[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [economics, setEconomics] = useState<Record<string, Economics>>({});
  const [performancePhotoFailed, setPerformancePhotoFailed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const vehicle = vehicles.find(item => item.id === selected) ?? vehicles[0];
  const filteredVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter(item => [item.year, item.make, item.model, item.vin, item.license_plate, item.status].some(value => String(value ?? "").toLowerCase().includes(needle)));
  }, [query, vehicles]);
  const ready = vehicles.filter(item => readyStatuses.has(item.status)).length;
  const attentionVehicles = vehicles.filter(item => !readyStatuses.has(item.status));
  const econ = vehicle ? economics[vehicle.id] ?? { purchase: "", monthly: "", expenses: "" } : { purchase: "", monthly: "", expenses: "" };
  const selectedFinance = financialEntries.filter(entry => entry.vehicle_id === vehicle?.id);
  const purchaseInvestment = selectedFinance.filter(entry => entry.category === "vehicle_investment").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const rentalIncome = selectedFinance.filter(entry => entry.category === "rental_income").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const maintenanceCost = selectedFinance.filter(entry => entry.category === "maintenance").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const repairCost = selectedFinance.filter(entry => entry.category === "repair").reduce((sum, entry) => sum + Number(entry.amount), 0);
  const vehicleExpenses = maintenanceCost + repairCost;
  const net = rentalIncome - vehicleExpenses;
  const returnRate = purchaseInvestment > 0 ? net / purchaseInvestment * 100 : 0;
  const economicsBars = [
    { label: "Investment", value: purchaseInvestment, tone: "investment" },
    { label: "Revenue", value: rentalIncome, tone: "income" },
    { label: "Maint. + repair", value: vehicleExpenses, tone: "expense" },
    { label: "Net return", value: Math.max(0, net), tone: "return" },
  ];
  const economicsMax = Math.max(...economicsBars.map(item => item.value), 1);
  const readiness = vehicle && readyStatuses.has(vehicle.status) ? 100 : 65;

  function openPanel(next: Exclude<Panel, null>) {
    openerRef.current = document.activeElement as HTMLElement;
    setPanel(next);
  }

  function closePanel() {
    setPanel(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  function saveEconomics(data: FormData) {
    if (vehicle) {
      setEconomics(current => ({ ...current, [vehicle.id]: { purchase: String(data.get("purchase") ?? ""), monthly: String(data.get("monthly") ?? ""), expenses: String(data.get("expenses") ?? "") } }));
    }
    closePanel();
  }

  useEffect(() => {
    if (!panel) return;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select:not([disabled])') ?? [])];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  useEffect(() => setPerformancePhotoFailed(false), [vehicle?.id, vehicle?.primary_photo]);

  const picker = (label: string) => <VehiclePicker vehicles={vehicles} value={vehicle?.id ?? ""} onChange={setSelected} label={label} />;

  return <>
    <header className="intel-top">
      <div><div className="intel-welcome">Welcome to the fleet brain.</div><span>{organizationName} · live intelligence network</span></div>
      <div className="intel-actions">{picker("Select workspace vehicle")}<Link className="glass-button intel-compact-action workshop-action" href="/dashboard/fleet-workshop?from=intelligence">Porter Operations</Link><Link className="glass-button intel-compact-action" href="/dashboard/finance">Fleet Finance</Link><Link className="glass-button intel-compact-action" href="/dashboard/smart-calendar">Smart Calendar</Link><Link className="button intel-compact-action" href="/dashboard/fleet/new?from=intelligence">Add vehicle</Link></div>
    </header>

    <div className="intel-grid top-intelligence-pair">
      <section id="live-telemetry" className="glass-card intel-performance rebuilt-performance top-fleet-performance">
        <Header eyebrow="Fleet performance" title="Selected vehicle pulse" action={picker("Select vehicle for pulse")} />
        {vehicle ? <><div className={`selected-performance-media ${vehicle.primary_photo&&!performancePhotoFailed?"has-photo":"no-photo"}`}>{vehicle.primary_photo && !performancePhotoFailed ? <img key={`${vehicle.id}-${vehicle.primary_photo}`} src={vehicle.primary_photo} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} onError={() => setPerformancePhotoFailed(true)} /> : <div className="performance-photo-empty"><span aria-hidden="true">▧</span><strong>{performancePhotoFailed ? "IMAGE UNAVAILABLE" : "NO PRIMARY PHOTO"}</strong><small>Add or manage photos in the full vehicle record.</small></div>}<div className="performance-identity"><small>SELECTED ASSET</small><strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong><span>VIN ending {vehicle.vin.slice(-6)}</span></div><div className="performance-readiness"><strong>{readiness}%</strong><span>readiness</span></div></div><div className="mini-bars"><span style={{ width: `${readiness}%` }} /></div><div className="pulse-stats"><span><b>{vehicle.status}</b>Status</span><span><b>{vehicle.odometer?.toLocaleString() ?? "—"}</b>Miles</span><span><b>{vehicle.daily_rate ? `$${vehicle.daily_rate}` : "—"}</b>Daily rate</span></div></> : <EmptyFleet />}
      </section>
      <section id="economics" className="glass-card top-fleet-economics">
        <Header eyebrow="Fleet economics" title="Investment & return" action={picker("Select vehicle for economics")} />
        <div className="economic-color-bars" role="img" aria-label="Vehicle investment, revenue, expenses, and net return"><div className="economic-scale"><span>Entered value</span><span>$0</span></div>{economicsBars.map(item => <div className="economic-bar-column" key={item.label}><strong>{item.value ? `$${item.value.toLocaleString()}` : "—"}</strong><div><i className={item.tone} style={{ height: `${item.value ? Math.max(12, item.value / economicsMax * 100) : 4}%` }} /></div><span>{item.label}</span></div>)}</div>
        <div className="economic-readout"><span>Vehicle investment<strong>{purchaseInvestment ? `$${purchaseInvestment.toLocaleString()}` : "Not recorded"}</strong></span><span>Net fleet return<strong className={net < 0 ? "negative-value" : ""}>{selectedFinance.length ? `$${net.toLocaleString()}` : "Awaiting entries"}</strong></span><span>Return on investment<strong>{purchaseInvestment ? `${returnRate.toFixed(1)}%` : "Awaiting investment"}</strong></span></div>
        <div className="card-footer-actions"><p className="data-note">Populated from {selectedFinance.length} shared Fleet Finance entr{selectedFinance.length === 1 ? "y" : "ies"} for this vehicle.</p><Link className="glass-button" href="/dashboard/finance">Add entry</Link></div>
      </section>
    </div>

    <FleetRevenueHero financialEntries={financialEntries} />

    <section className="intel-kpis" aria-label="Fleet intelligence summary">
      <article><span>Fleet assets</span><strong>{vehicles.length}</strong><small>Supabase records</small></article>
      <article><span>Rental ready</span><strong>{ready}</strong><small>{vehicles.length ? Math.round(ready / vehicles.length * 100) : 0}% of fleet</small></article>
      <article><span>Needs attention</span><strong className="amber">{attentionVehicles.length}</strong><small>Record exceptions</small></article>
      <article><span>Telematics online</span><strong>0</strong><small>No provider connected</small></article>
      <article><span>Daily rate capacity</span><strong>${vehicles.reduce((sum, item) => sum + Number(item.daily_rate || 0), 0).toLocaleString()}</strong><small>Verified rates</small></article>
    </section>

    <div className="intel-grid">
      <section id="vehicle-records" className="glass-card fleet-records unified-fleet-card">
        <Header eyebrow="Fleet records" title="Vehicles & full record" action={<Link href="/dashboard/fleet/new?from=intelligence" className="glass-button">Add vehicle</Link>} />
        <label className="fleet-filter"><span>Filter fleet</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search make, model, VIN, plate, or status" /></label>
        <div className="unified-fleet-layout"><div className="asset-list">{filteredVehicles.map(item => <button aria-pressed={selected === item.id} className={selected === item.id ? "active" : ""} key={item.id} onClick={() => setSelected(item.id)}><span className={`asset-monogram ${item.primary_photo ? "has-photo" : ""}`}>{item.primary_photo ? <img src={item.primary_photo} alt="" /> : item.make?.slice(0, 2) ?? "VE"}</span><span><strong>{item.year} {item.make} {item.model}</strong><small>VIN ···{item.vin.slice(-6)} · {item.odometer?.toLocaleString() ?? "—"} mi</small></span><em>{item.status}</em></button>)}{!filteredVehicles.length && <div className="intel-empty">{vehicles.length ? "No vehicles match this search." : "Add a verified vehicle to activate intelligence."}</div>}</div>{vehicle && <div className="unified-record-detail"><div className="selected-asset-summary">{vehicle.primary_photo ? <img src={vehicle.primary_photo} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} /> : <span>{vehicle.make?.slice(0, 2) ?? "VE"}</span>}<div><div className="eyebrow">Selected asset</div><h2>{vehicle.year} {vehicle.make} {vehicle.model}</h2><p>{vehicle.license_plate ?? "Plate missing"} · VIN ending {vehicle.vin.slice(-6)}</p></div><Link className="glass-button" href={`/dashboard/fleet/${vehicle.id}`}>Open full record</Link></div><div className="asset-facts"><span>STATUS<b>{vehicle.status}</b></span><span>PLATE<b>{vehicle.license_plate ?? "Missing"}</b></span><span>ODOMETER<b>{vehicle.odometer?.toLocaleString() ?? "Missing"}</b></span><span>DAILY RATE<b>{vehicle.daily_rate ? `$${vehicle.daily_rate}` : "Missing"}</b></span></div><div className="command-tiles"><button onClick={() => openPanel("telematics")}><b>Telematics</b><small>GPS, mileage, DTC and battery</small><em>VIEW STATUS →</em></button><Link href={`/dashboard/fleet/${vehicle.id}#vehicle-media`}><b>Vehicle media</b><small>Upload and manage persistent imagery</small><em>MANAGE →</em></Link><Link href="/dashboard/smart-calendar"><b>Maintenance calendar</b><small>Coordinate service windows</small><em>OPEN →</em></Link><Link href={`/dashboard/fleet/${vehicle.id}`}><b>Readiness record</b><small>Identity, rate and odometer</small><em>REVIEW →</em></Link></div></div>}</div>
      </section>

      <section id="fleet-alerts" className="glass-card intel-alerts"><Header eyebrow="Vehicle alert network" title="Exceptions requiring attention" action={<span className={attentionVehicles.length ? "alert-chip" : "live-chip"}>{attentionVehicles.length ? `${attentionVehicles.length} ACTIVE` : "ALL CLEAR"}</span>} />{attentionVehicles.map(item => <Link href={`/dashboard/fleet/${item.id}`} key={item.id}><i aria-hidden="true">!</i><span><strong>{item.year} {item.make} {item.model}</strong><small>Status is {item.status}. Complete the readiness record.</small></span><em>Review →</em></Link>)}{!attentionVehicles.length && <div className="intel-empty">No fleet record exceptions detected.</div>}</section>

      <section id="maintenance" className="glass-card intel-maintenance"><Header eyebrow="Smart Calendar coordination" title="Maintenance operations" action={picker("Select vehicle for maintenance")} /><div className="maintenance-timeline"><span /><article><b>Current signal</b><strong>Telematics not connected</strong><small>Predictions activate after diagnostics are ingested.</small></article><span /><article><b>Verified fallback</b><strong>{vehicle?.odometer?.toLocaleString() ?? "No"} recorded miles</strong><small>Use the full record while providers are pending.</small></article><span /><article><b>Calendar handoff</b><strong>Protect availability</strong><small>Block rental dates before service work.</small></article></div><div className="card-footer-actions"><span /><Link className="glass-button" href="/dashboard/smart-calendar">Schedule service</Link></div></section>
    </div>

    {panel && <div className="intel-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}><section ref={dialogRef} className="intel-modal" role="dialog" aria-modal="true" aria-labelledby="intel-modal-title"><button className="intel-close" onClick={closePanel} aria-label="Close dialog">×</button>{panel === "economics" ? <><div className="eyebrow">Asset economics planner</div><h2 id="intel-modal-title">Configure break-even analysis</h2><form action={saveEconomics}><label>Vehicle purchase price<input name="purchase" type="number" min="0" step="100" defaultValue={econ.purchase} /></label><label>Expected monthly revenue<input name="monthly" type="number" min="0" step="50" defaultValue={econ.monthly} /></label><label>Monthly operating expenses<input name="expenses" type="number" min="0" step="50" defaultValue={econ.expenses} /></label><button className="button">Calculate</button></form></> : <><div className="eyebrow">Live telemetry</div><h2 id="intel-modal-title">Provider connection status</h2><p>No telematics provider is connected to this organization. These integrations require credentials, consent, and a production provider contract.</p>{["Samsara", "Geotab", "Verizon Connect", "Bouncie", "Zubie"].map(provider => <div className="provider-row" key={provider}><strong>{provider}</strong><span>Not connected</span></div>)}</>}</section></div>}
  </>;
}

function VehiclePicker({ vehicles, value, onChange, label }: { vehicles: IntelligenceVehicle[]; value: string; onChange: (value: string) => void; label: string }) {
  return <label className="vehicle-picker"><span>Vehicle</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{vehicles.length === 0 && <option value="">No vehicles</option>}{vehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.vin.slice(-6)}</option>)}</select></label>;
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action: React.ReactNode }) {
  return <header><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action}</header>;
}

function EmptyFleet() {
  return <div className="performance-photo-empty"><strong>No vehicle selected</strong><Link href="/dashboard/fleet/new?from=intelligence">Add vehicle</Link></div>;
}

function FleetRevenueHero({ financialEntries }: { financialEntries: FleetFinancialEntry[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [financialMetric, setFinancialMetric] = useState<"cashflow" | "revenue" | "maintenance" | "repairs" | "investment" | "return">("cashflow");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  useEffect(() => () => recognitionRef.current?.abort(), []);
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yearLedger = monthLabels.map(label => ({ label, revenue: 0, maintenance: 0, repairs: 0, investment: 0 }));
  for (const entry of financialEntries) {
    const [year, month] = entry.entry_date.split("-").map(Number);
    if (year !== selectedYear || !month || !yearLedger[month - 1]) continue;
    const field = entry.category === "rental_income" ? "revenue" : entry.category === "repair" ? "repairs" : entry.category === "vehicle_investment" ? "investment" : "maintenance";
    yearLedger[month - 1][field] += Number(entry.amount);
  }
  const months = yearLedger.map(month => {
    const cashflow = month.revenue - month.maintenance - month.repairs;
    const returnValue = month.investment > 0 ? (month.revenue - month.maintenance - month.repairs) / month.investment * 100 : 0;
    const value = financialMetric === "cashflow" ? cashflow : financialMetric === "return" ? returnValue : month[financialMetric];
    return { ...month, cashflow, returnValue, value };
  });
  const metricCopy = {
    cashflow: { title: "Operating fleet cash flow", summary: "Recorded operating cash flow", note: "Rental income minus recorded maintenance and repairs; vehicle investment is excluded" },
    revenue: { title: "Fleet rental income", summary: "Recorded rental income", note: "Completed fleet rentals entered for the selected year" },
    maintenance: { title: "Fleet maintenance costs", summary: "Recorded maintenance", note: "Routine service and maintenance entered for fleet vehicles" },
    repairs: { title: "Fleet repair costs", summary: "Recorded repairs", note: "Repair spending entered for fleet vehicles" },
    investment: { title: "Vehicle investment", summary: "Recorded vehicle investment", note: "Vehicle purchase prices entered in the fleet ledger" },
    return: { title: "Fleet investment return", summary: "Recorded return rate", note: "Rental income less maintenance and repairs, compared with vehicle investment" },
  }[financialMetric];
  const maxValue = Math.max(...months.map(month => Math.abs(month.value)), 1);
  const totalInvestment = months.reduce((sum, month) => sum + month.investment, 0);
  const recordedTotal = financialMetric === "return" ? (totalInvestment ? months.reduce((sum, month) => sum + month.revenue - month.maintenance - month.repairs, 0) / totalInvestment * 100 : 0) : months.reduce((sum, month) => sum + month.value, 0);
  const hasRecords = yearLedger.some(month => month.revenue || month.maintenance || month.repairs || month.investment);

  async function askFleetAI(nextQuestion = question) {
    const prompt = nextQuestion.trim();
    if (!prompt || asking) return;
    setQuestion(prompt); setAsking(true); setAiError(""); setAnswer("");
    try {
      const response = await fetch("/api/vehicle-intelligence/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt }) });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Fleet AI could not answer.");
      setAnswer(result.answer || "No answer was returned.");
    } catch (error) { setAiError(error instanceof Error ? error.message : "Fleet AI could not answer."); }
    finally { setAsking(false); }
  }

  function toggleFleetMic() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setAiError("Voice input is not supported in this browser. You can still type your question."); return; }
    const recognition = new Recognition(); recognition.continuous = false; recognition.interimResults = true; recognition.lang = "en-US";
    recognition.onresult = event => { let transcript = ""; for (let index = 0; index < event.results.length; index++) transcript += event.results[index][0].transcript; setQuestion(transcript.trim()); };
    recognition.onerror = event => { setListening(false); setAiError(event.error === "not-allowed" ? "Microphone permission was denied." : `Voice input stopped: ${event.error.replaceAll("-", " ")}.`); };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition; setAiError(""); setListening(true);
    try { recognition.start(); } catch { setListening(false); setAiError("The microphone could not start."); }
  }

  return <section className="fleet-revenue-hero" aria-labelledby="fleet-revenue-title">
    <header className="revenue-hero-head"><div><div className="eyebrow">Fleet financial record</div><h1 id="fleet-revenue-title">{metricCopy.title}</h1><p>{metricCopy.note}. Every chart value comes from the shared Fleet Finance ledger.</p></div><div className="financial-controls"><div className="financial-lens"><label htmlFor="financial-metric">Fleet statistic</label><select id="financial-metric" value={financialMetric} onChange={event => setFinancialMetric(event.target.value as typeof financialMetric)}><option value="cashflow">Operating fleet cash flow</option><option value="revenue">Rental income</option><option value="maintenance">Maintenance costs</option><option value="repairs">Repair costs</option><option value="investment">Vehicle investment</option><option value="return">Investment return</option></select></div><div className="financial-lens year-lens"><label htmlFor="financial-year">Cash-flow year</label><select id="financial-year" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))}>{[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(year => <option key={year}>{year}</option>)}</select></div><Link className="ledger-toggle" href="/dashboard/finance">Open Fleet Finance</Link></div></header>
    <div className="revenue-hero-grid">
      <div className="revenue-summary"><span>{metricCopy.summary}</span><strong>{financialMetric === "return" ? `${recordedTotal.toFixed(1)}%` : `$${Math.round(recordedTotal).toLocaleString()}`}</strong><small>{hasRecords ? `Host-entered fleet activity for ${selectedYear}` : `No fleet financial entries for ${selectedYear}`}</small><div className="cashflow-key"><i className="key-revenue" />Income <i className="key-maintenance" />Maintenance <i className="key-repairs" />Repairs <i className="key-investment" />Investment</div></div>
      <div className={`revenue-chart annual-chart metric-${financialMetric}`} role="img" aria-label={`${metricCopy.title} for ${selectedYear}`}>
        {months.map(month => <div className="revenue-month" key={month.label}><div className="revenue-value">{financialMetric === "return" ? `${month.value.toFixed(0)}%` : `$${Math.round(month.value / 100) / 10}k`}</div><div className="revenue-bar-track"><i className={month.value < 0 ? "negative" : ""} style={{ height: `${month.value ? Math.max(5, Math.abs(month.value) / maxValue * 100) : 0}%` }}><b /></i></div><strong>{month.label}</strong><small>{month.value ? "recorded" : "no entry"}</small></div>)}
      </div>
      <aside className="revenue-ai-brief"><div className="ai-orbit">✦</div><div><span>Fleet record summary</span><strong>{hasRecords ? `This chart shows the company’s recorded ${metricCopy.title.toLowerCase()} for ${selectedYear}.` : `The company has not entered fleet financial activity for ${selectedYear}.`}</strong><p>Fleet Finance is the shared source for rental income, maintenance, repairs, and vehicle purchase costs. No business-wide overhead or generated projections are included.</p></div></aside>
    </div>
    <div className="fleet-ai-question">
      <div className="fleet-ai-question-head"><div><span>Ask Fleet AI</span><strong>Question your fleet data</strong></div><em>Powered by OpenAI · organization scoped</em></div>
      <div className="fleet-ai-input"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") askFleetAI(); }} placeholder="Ask about rates, readiness, revenue opportunity, or which vehicle needs attention…" maxLength={600} aria-label="Ask Fleet AI a question" /><button type="button" className={`fleet-ai-mic ${listening ? "listening" : ""}`} onClick={toggleFleetMic} aria-label={listening ? "Stop listening" : "Ask with microphone"} aria-pressed={listening}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"/></svg></button><button type="button" className="fleet-ai-submit" disabled={!question.trim() || asking} onClick={() => askFleetAI()}>{asking ? "Thinking…" : "Ask AI"}</button></div>
      <div className="fleet-ai-prompts">{["Which vehicles need attention?", "How can I improve projected revenue?", "Which ready vehicle has the highest rate?"].map(prompt => <button type="button" key={prompt} onClick={() => askFleetAI(prompt)} disabled={asking}>{prompt}</button>)}</div>
      {(answer || aiError || listening) && <div className={`fleet-ai-answer ${aiError ? "error" : ""}`} aria-live="polite">{listening ? "Listening…" : aiError || answer}</div>}
    </div>
  </section>;
}
