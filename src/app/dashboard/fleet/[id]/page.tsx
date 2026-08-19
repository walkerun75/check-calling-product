import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { updateVehicle } from "./actions";
import PhotoUploader from "./photo-uploader";
import RecordInputCenter from "./record-input-center";
import VehicleHistoryPanels from "./vehicle-history-panels";
import VehicleCoreDetails from "./vehicle-core-details";
import "./vehicle-record.css";
import "./record-enhancements.css";
import "./compact-record.css";
import "./record-input-center.css";
import "./record-link.css";
import "./vehicle-history-panels.css";
import "./vehicle-core-details.css";

type FinancialEntry={entry_date:string;category:string;amount:number};
type WorkshopJob={status:string;started_at:string|null;completed_at:string|null;created_at:string};
type WorkOrder={status:string;severity:string;created_at:string;completed_at:string|null};
const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);

export default async function VehiclePage({ params, searchParams }: { params:Promise<{id:string}>; searchParams:Promise<{error?:string;saved?:string;photo?:string}> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data:vehicle } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
  if (!vehicle) notFound();
  const currentYear=new Date().getFullYear();
  const [{data:financialRows},{data:workshopRows},{data:workOrderRows}]=await Promise.all([
    supabase.from("fleet_financial_entries").select("entry_date,category,amount").eq("vehicle_id",id).gte("entry_date",`${currentYear}-01-01`).lte("entry_date",`${currentYear}-12-31`).order("entry_date"),
    supabase.from("fleet_workshop_jobs").select("status,started_at,completed_at,created_at,notes,checklist").eq("vehicle_id",id).order("created_at",{ascending:false}),
    supabase.from("maintenance_work_orders").select("status,severity,created_at,completed_at").eq("vehicle_id",id).order("created_at",{ascending:false}),
  ]);
  const financials=(financialRows??[]) as FinancialEntry[],workshops=(workshopRows??[]) as WorkshopJob[],workOrders=(workOrderRows??[]) as WorkOrder[];
  const revenue=financials.filter(row=>row.category==="rental_income").reduce((sum,row)=>sum+Number(row.amount),0);
  const investment=financials.filter(row=>row.category==="vehicle_investment").reduce((sum,row)=>sum+Number(row.amount),0);
  const operatingCosts=financials.filter(row=>row.category!=="rental_income"&&row.category!=="vehicle_investment").reduce((sum,row)=>sum+Number(row.amount),0);
  const netReturn=revenue-operatingCosts,roi=investment&&revenue?netReturn/investment*100:null;
  const completedTurns=workshops.filter(job=>job.status==="completed"||job.status==="ready");
  const timedTurns=completedTurns.filter(job=>job.started_at&&job.completed_at&&new Date(job.completed_at).getTime()>new Date(job.started_at).getTime());
  const averageTurnHours=timedTurns.length?timedTurns.reduce((sum,job)=>sum+(new Date(job.completed_at!).getTime()-new Date(job.started_at!).getTime())/3600000,0)/timedTurns.length:null;
  const activeMaintenance=workOrders.filter(order=>!["completed","cancelled"].includes(order.status)).length;
  const monthly=Array.from({length:12},(_,month)=>{const rows=financials.filter(row=>new Date(`${row.entry_date}T12:00:00`).getMonth()===month);return{label:new Date(currentYear,month,1).toLocaleString("en-US",{month:"short"}),revenue:rows.filter(row=>row.category==="rental_income").reduce((sum,row)=>sum+Number(row.amount),0),cost:rows.filter(row=>row.category!=="rental_income"&&row.category!=="vehicle_investment").reduce((sum,row)=>sum+Number(row.amount),0)}});
  const chartMax=Math.max(1,...monthly.flatMap(month=>[month.revenue,month.cost]));
  const [{data:operationalProfile},{data:rentalRows},{data:documentRows}]=await Promise.all([
    supabase.from("vehicle_operational_profiles").select("*").eq("vehicle_id",id).maybeSingle(),
    supabase.from("vehicle_rental_activity").select("id,starts_at,ends_at,revenue,platform_fees,start_odometer,end_odometer,status,reference_number").eq("vehicle_id",id).order("starts_at",{ascending:false}),
    supabase.from("vehicle_documents").select("id,document_type,file_name,expires_on,created_at").eq("vehicle_id",id).order("created_at",{ascending:false}),
  ]);
  const {data:vehicleFinancing}=await supabase.from("vehicle_financing_accounts").select("account_type,lender,current_balance,estimated_vehicle_value,purchase_option_amount,annual_rate,term_months").eq("vehicle_id",id).maybeSingle();
  const { data: photoRows } = await supabase
    .from("vehicle_photos")
    .select("id,public_url,storage_path,alt_text,is_primary,sort_order,created_at")
    .eq("vehicle_id", id)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  let photos = (photoRows ?? []).map(photo => ({
    id: photo.id,
    public_url: photo.public_url || (photo.storage_path ? supabase.storage.from("vehicle-photos").getPublicUrl(photo.storage_path).data.publicUrl : ""),
    alt_text: photo.alt_text,
    is_primary: photo.is_primary,
  })).filter(photo => photo.public_url);
  if (!photos.length) {
    const storageAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const folder = `${vehicle.organization_id}/${id}`;
    const { data: storedFiles } = await storageAdmin.storage.from("vehicle-photos").list(folder, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
    const availableFiles = (storedFiles ?? []).filter(file => file.name && !file.name.startsWith("."));
    const fallbackFile = availableFiles.find(file => file.name.startsWith("primary.")) ?? availableFiles[0];
    photos = fallbackFile ? [{ id: `${folder}/${fallbackFile.name}`, public_url: storageAdmin.storage.from("vehicle-photos").getPublicUrl(`${folder}/${fallbackFile.name}`).data.publicUrl, alt_text: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, is_primary: true }] : [];
  }
  const checks = [
    {label:"VIN decoded", complete:Boolean(vehicle.vin && vehicle.year && vehicle.make && vehicle.model)},
    {label:"License plate recorded", complete:Boolean(vehicle.license_plate)},
    {label:"Odometer recorded", complete:vehicle.odometer !== null},
    {label:"Daily rental rate set", complete:Number(vehicle.daily_rate) > 0},
  ];
  const completed = checks.filter(c=>c.complete).length;
  const op=(operationalProfile??{}) as Record<string,unknown>;
  const recordSignals=[...checks,{label:"Primary vehicle photo",complete:photos.length>0},{label:"Purchase investment",complete:investment>0},{label:"Porter inspection history",complete:workshops.length>0},{label:"Maintenance history",complete:workOrders.length>0},{label:"Registration and expiration",complete:Boolean(op.registration_expires_on)},{label:"Insurance policy and expiration",complete:Boolean(op.insurance_policy&&op.insurance_expires_on)},{label:"Inspection or emissions expiration",complete:Boolean(op.inspection_expires_on)},{label:"Next service date and mileage",complete:Boolean(op.next_service_on||op.next_service_odometer)},{label:"Title, warranty, and roadside documents",complete:(documentRows??[]).length>0},{label:"Completed rental history",complete:(rentalRows??[]).length>0},{label:"Damage and condition history",complete:workshops.some(job=>job.status==="issue_found"||job.status==="maintenance_hold")}];
  const recordComplete=recordSignals.filter(item=>item.complete).length;
  const missingRecords=recordSignals.filter(item=>!item.complete);
  return <main className="shell">
    <header className="topbar"><Link className="brand" href="/dashboard">Check<i>✓</i>Calling</Link><Link className="button secondary" href="/dashboard">Back to Fleet</Link></header>
    <section><div className="eyebrow">Vehicle record</div><h1 style={{fontSize:46}}>{vehicle.year} {vehicle.make} {vehicle.model}</h1><p className="lede">VIN {vehicle.vin} · Current status: <span className="pill">{vehicle.status}</span></p></section>
    <section className="vehicle-intelligence"><div className="eyebrow">Vehicle operating intelligence · {currentYear}</div><div className="record-kpis"><article className="good"><span>Rental revenue</span><strong>{money(revenue)}</strong><small>Recorded income</small></article><article className="cost"><span>Operating costs</span><strong>{money(operatingCosts)}</strong><small>Maintenance and fleet expenses</small></article><article className={netReturn>=0?"good":"cost"}><span>Net operating return</span><strong>{money(netReturn)}</strong><small>Revenue minus operating costs</small></article><article className="invest"><span>Vehicle investment</span><strong>{money(investment)}</strong><small>Recorded purchase investment</small></article><article><span>Return on investment</span><strong>{roi===null?"—":`${roi.toFixed(1)}%`}</strong><small>{roi===null?"Investment needed":"Based on recorded activity"}</small></article><article><span>Verified days on road</span><strong>—</strong><small>Rental history connection needed</small></article></div><div className="vehicle-record-grid"><section className="record-chart"><header><div><div className="eyebrow">Monthly vehicle cash flow</div><h2>Revenue and operating cost</h2></div><div className="chart-legend"><span><i className="earned"/>Revenue</span><span><i className="spent"/>Costs</span></div></header><div className="vehicle-monthly-chart">{monthly.map(month=><div className="vehicle-month" key={month.label}><div className="vehicle-bars"><i className="earned" title={`${month.label} revenue ${money(month.revenue)}`} style={{height:`${Math.max(month.revenue?8:2,month.revenue/chartMax*100)}%`}}/><i className="spent" title={`${month.label} cost ${money(month.cost)}`} style={{height:`${Math.max(month.cost?8:2,month.cost/chartMax*100)}%`}}/></div><strong>{month.label}</strong><small>{money(month.revenue-month.cost)}</small></div>)}</div></section><section className="record-health"><header><div><div className="eyebrow">Operations and health</div><h2>Vehicle activity</h2></div></header><div className="health-list"><article><div><span>Turnarounds completed</span><small>Porter Operations records</small></div><b>{completedTurns.length}</b></article><article><div><span>Average turnaround</span><small>Return through ready status</small></div><b>{averageTurnHours===null?"—":`${averageTurnHours.toFixed(1)}h`}</b></article><article><div><span>Open maintenance</span><small>Active work orders</small></div><b className={activeMaintenance?"warn":""}>{activeMaintenance}</b></article><article><div><span>Current odometer</span><small>Latest verified record</small></div><b>{Number(vehicle.odometer??0).toLocaleString()}</b></article><article><div><span>Daily rental rate</span><small>Current listed capacity</small></div><b>{money(Number(vehicle.daily_rate??0))}</b></article></div><div className="data-note">Days rented, utilization, average trip length, and revenue per road day will activate when the Rentals workflow begins storing completed booking dates.</div></section></div></section>
    <section className="record-completeness"><div><div className="eyebrow">Full record status</div><h2>{missingRecords.length?"This vehicle record needs more information":"Core vehicle record complete"}</h2><p>Completeness is separate from rental readiness. Select an item to open its details or input point on this page.</p><div className="completion-score"><strong>{recordComplete}/{recordSignals.length}</strong><span>connected record signals</span></div></div><div className="missing-list">{missingRecords.map(item=><Link key={item.label} href={item.label.includes("Photo")?"#vehicle-media":item.label.includes("investment")?"#financial-history":item.label.includes("Maintenance")?"#embedded-maintenance-history":item.label.includes("document")?"#vehicle-documents":item.label.includes("rental")?"#rental-history":item.label.includes("Damage")?"#inspection-history":"#compliance"}>+ {item.label}</Link>)}<Link className="connected" href="#financial-history">✓ Finance and Porter Operations connected</Link></div></section>
    <VehicleCoreDetails profile={operationalProfile as Record<string,unknown>|null} financing={vehicleFinancing as Record<string,unknown>|null}/>
    <VehicleHistoryPanels financials={financials as unknown as Array<Record<string,unknown>>} workshops={workshops as unknown as Array<Record<string,unknown>>} workOrders={workOrders as unknown as Array<Record<string,unknown>>} rentals={(rentalRows??[]) as Array<Record<string,unknown>>} documents={(documentRows??[]) as Array<Record<string,unknown>>}/>
    <RecordInputCenter vehicleId={id} profile={operationalProfile as Record<string,unknown>|null} rentals={(rentalRows??[]) as Array<Record<string,unknown>>} documents={(documentRows??[]) as Array<Record<string,unknown>>}/>
    <div className="compact-record-lower"><PhotoUploader vehicleId={id} photos={photos} status={query.photo} />
    <div className="grid">
      <section className="card"><div className="eyebrow">Readiness</div><div className="metric">{completed}/4</div><div className="steps">{checks.map((check,index)=><div className="step" key={check.label}><span className="num">{check.complete ? "✓" : index+1}</span><div><strong>{check.label}</strong><br/><span className="muted">{check.complete ? "Complete" : "Required before rental readiness"}</span></div></div>)}</div></section>
      <section className="card"><div className="eyebrow">Vehicle details</div><h2>Complete the record</h2>{query.error && <p className="alert">{query.error}</p>}{query.saved && <p className="alert success">Vehicle record updated.</p>}
        <form action={updateVehicle.bind(null, id)} className="form">
          <div className="field"><label>License plate</label><input name="license_plate" defaultValue={vehicle.license_plate ?? ""} required/></div>
          <div className="field"><label>Current odometer</label><input name="odometer" type="number" min="0" defaultValue={vehicle.odometer ?? ""} required/></div>
          <div className="field"><label>Daily rental rate</label><input name="daily_rate" type="number" min="0.01" step="0.01" defaultValue={vehicle.daily_rate ?? ""} required/></div>
          <div className="actions"><button className="button secondary" name="mark_ready" value="no">Save draft</button><button className="button" name="mark_ready" value="yes">Mark vehicle ready</button></div>
        </form>
      </section>
    </div></div>
  </main>;
}
