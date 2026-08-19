import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import VehicleIntelligenceClient, { type FleetFinancialEntry } from "./vehicle-intelligence-client";
import "./vehicle-intelligence.css";

export type IntelligenceVehicle = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  vin: string;
  license_plate: string | null;
  odometer: number | null;
  daily_rate: number | null;
  primary_photo?: string | null;
};

const workspaceLinks = [
  ["◉", "Vehicle pulse", "/dashboard/vehicle-intelligence/pulse"],
  ["▦", "Vehicle records", "#vehicle-records"],
  ["▣", "Porter Operations", "/dashboard/fleet-workshop?from=intelligence"],
  ["◉", "Live telemetry", "#live-telemetry"],
  ["⌁", "Maintenance", "#maintenance"],
  ["▥", "Fleet Finance", "/dashboard/finance"],
  ["△", "Fleet alerts", "#fleet-alerts"],
];

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id,role,organizations(name,launch_status)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const organization = membership?.organizations as unknown as { name?: string; launch_status?: string } | null;
  if (["owner", "admin"].includes(membership?.role ?? "") && organization?.launch_status !== "active") redirect("/launch");

  const { data, error } = membership?.organization_id
    ? await supabase
        .from("vehicles")
        .select("id,year,make,model,status,vin,license_plate,odometer,daily_rate")
        .eq("organization_id", membership.organization_id)
        .order("created_at")
    : { data: [], error: null };
  const vehicleRows = (data ?? []) as IntelligenceVehicle[];
  const vehicleIds = vehicleRows.map(vehicle => vehicle.id);
  const { data: photoData } = vehicleIds.length
    ? await supabase.from("vehicle_photos").select("vehicle_id,public_url,storage_path,is_primary,sort_order,created_at").in("vehicle_id", vehicleIds).order("is_primary", { ascending:false }).order("sort_order", { ascending:true }).order("created_at", { ascending:true })
    : { data: [] };
  const photoByVehicle = new Map<string,string>();
  for (const photo of photoData ?? []) {
    if (photoByVehicle.has(photo.vehicle_id)) continue;
    const url = photo.public_url || (photo.storage_path ? supabase.storage.from("vehicle-photos").getPublicUrl(photo.storage_path).data.publicUrl : null);
    if (url) photoByVehicle.set(photo.vehicle_id, url);
  }
  if (membership?.organization_id) {
    const storageAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const vehicle of vehicleRows) {
      if (photoByVehicle.has(vehicle.id)) continue;
      const folder = `${membership.organization_id}/${vehicle.id}`;
      const { data: storedFiles } = await storageAdmin.storage.from("vehicle-photos").list(folder, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
      const availableFiles = storedFiles?.filter(file => file.name && !file.name.startsWith(".")) ?? [];
      const storedFile = availableFiles.find(file => file.name.startsWith("primary.")) ?? availableFiles[0];
      if (storedFile) {
        const publicUrl = storageAdmin.storage.from("vehicle-photos").getPublicUrl(`${folder}/${storedFile.name}`).data.publicUrl;
        if (publicUrl) photoByVehicle.set(vehicle.id, publicUrl);
      }
    }
  }
  const vehicles = vehicleRows.map(vehicle => ({ ...vehicle, primary_photo: photoByVehicle.get(vehicle.id) ?? null }));
  const { data: financialData, error: financialError } = membership?.organization_id
    ? await supabase.from("fleet_financial_entries").select("vehicle_id,entry_date,category,amount").eq("organization_id", membership.organization_id).order("entry_date")
    : { data: [], error: null };
  const financialEntries = (financialData ?? []) as FleetFinancialEntry[];

  return (
    <div className="intel-world">
      <aside className="intel-world-sidebar" aria-label="Vehicle Intelligence navigation">
        <Link className="intel-world-logo" href="/dashboard/command-center">
          <span>✓</span><strong>Check Calling</strong><small>VEHICLE INTELLIGENCE</small>
        </Link>
        <div className="intel-world-label">FLEET BRAIN</div>
        <nav>
          {workspaceLinks.map(([icon, label, href], index) => (
            <a className={index === 0 ? "active" : ""} href={href} key={label}>
              <i>{icon}</i><span>{label}</span>{label === "Fleet alerts" && <em>{vehicles.filter(v => !["ready", "rented"].includes(v.status)).length}</em>}
            </a>
          ))}
        </nav>
        <div className="intel-world-label">CONNECTED WORKSPACES</div>
        <nav>
          <Link href="/dashboard/smart-calendar"><i>□</i><span>Smart Calendar</span></Link>
          <Link href="/dashboard/command-center"><i>◇</i><span>Command Center</span></Link>
        </nav>
        <Link className="intel-add-asset" href="/dashboard/fleet/new">＋ Add vehicle</Link>
        <div className="intel-world-profile"><span>{user.email?.charAt(0).toUpperCase()}</span><div><strong>{user.email?.split("@")[0]}</strong><small>{organization?.name ?? "Host account"}</small></div></div>
      </aside>

      <div className="intel-world-stage">
        <header className="intel-world-bar">
          <div className="intel-world-context"><strong>Vehicle Intelligence</strong><span>Search and select vehicles in Vehicles &amp; full record</span></div>
          <div><span className="intel-live-signal">● DATABASE LIVE</span><Link href="/dashboard/command-center">Exit Fleet Brain</Link></div>
        </header>
        {(error || financialError) && <div className="intel-data-error">Portal records could not be fully loaded. {error?.message || financialError?.message}</div>}
        <main className="intelligence-page" id="fleet-overview">
          <VehicleIntelligenceClient vehicles={vehicles} organizationName={organization?.name ?? "Check Calling"} financialEntries={financialEntries} />
        </main>
      </div>
    </div>
  );
}
