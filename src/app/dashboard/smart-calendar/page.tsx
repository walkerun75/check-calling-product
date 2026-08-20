import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import PortalControls from "../command-center/portal-controls";
import SmartCalendarClient from "./smart-calendar-client";
import "./smart-calendar-readable.css";

type Vehicle = { id:string; year:number|null; make:string|null; model:string|null; status:string; vin:string; primary_photo?:string|null };

export default async function SmartCalendarPage() {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data:membership } = await supabase.from("organization_members").select("organization_id, role, organizations(name, launch_status)").eq("user_id",user.id).limit(1).maybeSingle();
  const organization = membership?.organizations as unknown as {name?:string;launch_status?:string} | null;
  if (["owner","admin"].includes(membership?.role ?? "") && organization?.launch_status !== "active") redirect("/launch");
  const { data } = membership?.organization_id ? await supabase.from("vehicles").select("id,year,make,model,status,vin").eq("organization_id",membership.organization_id).order("created_at") : {data:[]};
  const vehicleRows = (data ?? []) as Vehicle[];
  const storageAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const vehicles = await Promise.all(vehicleRows.map(async vehicle => {
    if (!membership?.organization_id) return { ...vehicle, primary_photo: null };
    const folder = `${membership.organization_id}/${vehicle.id}`;
    const { data: storedFiles } = await storageAdmin.storage.from("vehicle-photos").list(folder, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
    const availableFiles = storedFiles?.filter(file => file.name && !file.name.startsWith(".")) ?? [];
    const primaryFile = availableFiles.find(file => file.name.startsWith("primary.")) ?? availableFiles[0];
    const primaryPhoto = primaryFile ? storageAdmin.storage.from("vehicle-photos").getPublicUrl(`${folder}/${primaryFile.name}`).data.publicUrl : null;
    return { ...vehicle, primary_photo: primaryPhoto };
  }));
  const { data:workshopRows, count: workshopCount } = membership?.organization_id ? await supabase.from("fleet_workshop_jobs").select("id,vehicle_id,status,due_at",{count:"exact"}).eq("organization_id",membership.organization_id).not("status","in",'("completed","ready")') : {data:[],count:0};
  return <div><PortalControls/><div className="portal-main"><main className="shell calendar-page">
    <SmartCalendarClient vehicles={vehicles} organizationName={organization?.name ?? "Check Calling"} workshopCount={workshopCount??0} workshopEvents={(workshopRows??[]).map(row=>({id:row.id,vehicleId:row.vehicle_id,status:row.status,dueAt:row.due_at}))}/>
  </main></div>
  <aside className="side-menu" id="operations-sidebar" aria-label="Portal navigation">
    <div className="side-logo">Check<i>✓</i>Calling</div>
    <div className="side-status"><span className="avatar">O</span><div><strong>Operations Live</strong><small>Fleet connected · {vehicles.length} vehicle{vehicles.length===1?"":"s"}</small></div></div>
    <nav className="side-nav">
      <Link className="side-link" href="/dashboard/command-center"><span>▦</span>Command Center<em>LIVE</em></Link>
      <Link className="side-link active" href="/dashboard/smart-calendar"><span>▣</span>Smart Calendar<em>AI</em></Link>
      <Link className="side-link" href="/dashboard/fleet-workshop?from=calendar"><span>▤</span>Porter Operations<em>{workshopCount??0}</em></Link>
      <Link className="side-link" href="/dashboard/vehicle-intelligence"><span>🚙</span>Vehicle Intelligence<em>LIVE</em></Link>
      {[["◎","Website"],["◇","Marketing"],["✓","Check Callin"],["$","Finance"],["✉","Messages"],["□","Integrations"],["⚙","Settings"],["▤","Agreements"],["▥","Insights"]].map(([icon,label])=><span className="side-link disabled" aria-disabled="true" key={label}><span>{icon}</span>{label}<em>SOON</em></span>)}
    </nav>
    <div className="host-card"><span className="avatar">R</span><div><strong>{user.email?.split("@")[0] ?? "Host"}</strong><small>{organization?.name ?? "Owner account"}</small></div></div>
  </aside></div>;
}
