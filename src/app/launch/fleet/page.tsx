import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLaunchContext } from "@/lib/launch";
import VinForm from "@/app/dashboard/fleet/new/vin-form";
import { updateLaunchStep } from "../actions";
import "./fleet-setup.css";


async function deleteFleetVehicle(formData: FormData) {
  "use server";

  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  if (!vehicleId) redirect("/launch/fleet?error=Missing vehicle ID");

  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) {
    redirect("/dashboard/command-center");
  }

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("organization_id", membership.organization_id);

  if (error) {
    redirect(`/launch/fleet?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/launch/fleet");
  redirect("/launch/fleet?deleted=1");
}

type FleetVehicle = {
  id: string; vin: string; year: number | null; make: string; model: string;
  trim: string | null; license_plate: string | null; odometer: number | null;
  daily_rate: number | null; status: string;
};

export default async function FleetSetupPage({ searchParams }: { searchParams: Promise<{ created?: string; deleted?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const [{ data: step }, { data: vehicles }] = await Promise.all([
    supabase.from("organization_launch_steps").select("status").eq("organization_id", membership.organization_id).eq("step_key", "fleet").single(),
    supabase.from("vehicles").select("id,vin,year,make,model,trim,license_plate,odometer,daily_rate,status").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }),
  ]);
  const fleet = (vehicles ?? []) as FleetVehicle[];

  return <main className="fleet-setup-page">
    <header className="fleet-setup-top">
      <Link className="fleet-setup-brand" href="/launch?edit=1&step=fleet">Check<i>✓</i>Calling</Link>
      <strong>Fleet Setup</strong>
      <div className="fleet-setup-search">⌕ Search... <kbd>Ctrl K</kbd></div>
      <b>3/8 setup · {step?.status?.replace("_", " ")}</b>
    </header>
    <div className="fleet-setup-workspace">
      <Link className="fleet-back" href="/launch?edit=1&step=fleet">← Back to setup</Link>
      <section className="fleet-heading">
        <div><div className="fleet-eyebrow">Fleet onboarding · Setup 3</div><h1>Build your verified fleet</h1><p>Decode each VIN with the official NHTSA vehicle service, review the details, and save the record before accepting rentals.</p></div>
        <div className="fleet-count"><strong>{fleet.length}</strong><span>{fleet.length === 1 ? "vehicle record" : "vehicle records"}</span></div>
      </section>
      {params.created && <div className="fleet-success" role="status">Vehicle saved successfully. The Fleet Setup record has been updated.</div>}
       {params.deleted && <div className="fleet-success" role="status">Vehicle deleted from Fleet Inventory.</div>}
      {params.error && <div className="fleet-error" role="alert">{params.error}</div>}

      <section className="fleet-layout">
        <div className="fleet-intake-card">
          <div className="fleet-section-label">Add vehicle</div><h2>VIN-first fleet intake</h2>
          <p>Enter the 17-character VIN. Nothing is saved until you review the decoded vehicle and select Save vehicle to Fleet.</p>
          <VinForm returnToLaunch />
        </div>
        <aside className="fleet-readiness-card">
          <div className="fleet-section-label">Fleet readiness</div><h2>{fleet.length ? "Fleet records connected" : "Waiting for first vehicle"}</h2>
          <p>{fleet.length ? "Your saved vehicles now provide real records for the command radar and downstream rental workflows." : "Add at least one vehicle before Fleet Setup can be completed."}</p>
          <ul><li>VIN decoded and reviewed</li><li>Rate and operating details recorded</li><li>Vehicle available to connected workflows</li></ul>
          <form action={updateLaunchStep}><input type="hidden" name="stepKey" value="fleet"/><input type="hidden" name="intent" value="complete"/><button className="fleet-complete" disabled={!fleet.length}>{step?.status === "complete" ? "✓ Fleet Setup complete" : "Mark Fleet Setup complete"}</button></form>
        </aside>
      </section>

      <section className="fleet-inventory">
        <div className="fleet-inventory-head"><div><div className="fleet-section-label">Saved records</div><h2>Fleet inventory</h2></div><span>{fleet.length} total</span></div>
        {!fleet.length ? <div className="fleet-empty"><strong>No vehicles added yet</strong><p>Your first decoded vehicle will appear here.</p></div> : <div className="fleet-table-wrap"><table><thead><tr><th>Vehicle</th><th>VIN</th><th>Plate</th><th>Odometer</th><th>Daily rate</th><th>Status</th><th>Actions</th></tr></thead><tbody>{fleet.map(vehicle => <tr key={vehicle.id}><td><strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong><small>{vehicle.trim || "Trim not recorded"}</small></td><td>{vehicle.vin}</td><td>{vehicle.license_plate || "—"}</td><td>{vehicle.odometer ? `${vehicle.odometer.toLocaleString()} mi` : "—"}</td><td>{vehicle.daily_rate == null ? "—" : `$${Number(vehicle.daily_rate).toFixed(2)}`}</td><td><span className={`fleet-status ${vehicle.status}`}>{vehicle.status}</span></td><td><form action={deleteFleetVehicle}><input type="hidden" name="vehicleId" value={vehicle.id}/><button type="submit" aria-label={`Delete ${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`} style={{padding:"7px 10px",border:"1px solid #ff5d66",borderRadius:"7px",background:"transparent",color:"#ff737b",fontWeight:800,cursor:"pointer"}}>Delete</button></form></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </main>;
}
