import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/server";
import type {IntelligenceVehicle} from "../page";
import PulseClient from "./pulse-client";
import "../vehicle-intelligence.css";

export default async function VehiclePulsePage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:member}=await supabase.from("organization_members").select("organization_id").eq("user_id",user.id).limit(1).maybeSingle();
 const {data:rows}=member?.organization_id?await supabase.from("vehicles").select("id,year,make,model,status,vin,license_plate,odometer,daily_rate").eq("organization_id",member.organization_id).order("created_at"):{data:[]};
 const vehicles=(rows??[]) as IntelligenceVehicle[],ids=vehicles.map(vehicle=>vehicle.id);
 const {data:photos}=ids.length?await supabase.from("vehicle_photos").select("vehicle_id,public_url,storage_path,is_primary,sort_order,created_at").in("vehicle_id",ids).order("is_primary",{ascending:false}).order("sort_order",{ascending:true}).order("created_at",{ascending:true}):{data:[]};
 const photoMap=new Map<string,string>();for(const photo of photos??[]){if(photoMap.has(photo.vehicle_id))continue;const url=photo.public_url||(photo.storage_path?supabase.storage.from("vehicle-photos").getPublicUrl(photo.storage_path).data.publicUrl:null);if(url)photoMap.set(photo.vehicle_id,url)}
 if(member?.organization_id){const storageAdmin=createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});for(const vehicle of vehicles){if(photoMap.has(vehicle.id))continue;const folder=`${member.organization_id}/${vehicle.id}`;const {data:stored}=await storageAdmin.storage.from("vehicle-photos").list(folder,{limit:20,sortBy:{column:"created_at",order:"desc"}});const available=stored?.filter(item=>item.name&&!item.name.startsWith("."))??[];const file=available.find(item=>item.name.startsWith("primary."))??available[0];if(file){const url=storageAdmin.storage.from("vehicle-photos").getPublicUrl(`${folder}/${file.name}`).data.publicUrl;if(url)photoMap.set(vehicle.id,url)}}}
 const hydrated=vehicles.map(vehicle=>({...vehicle,primary_photo:photoMap.get(vehicle.id)??null}));
 return <div className="intel-world"><aside className="intel-world-sidebar"><Link className="intel-world-logo" href="/dashboard/vehicle-intelligence"><span>✓</span><strong>Check Calling</strong><small>VEHICLE INTELLIGENCE</small></Link><div className="intel-world-label">FLEET BRAIN</div><nav><Link className="active" href="/dashboard/vehicle-intelligence/pulse"><i>◉</i><span>Vehicle pulse</span></Link><Link href="/dashboard/vehicle-intelligence#vehicle-records"><i>▦</i><span>Vehicle records</span></Link><Link href="/dashboard/vehicle-intelligence#economics"><i>▥</i><span>Economics</span></Link><Link href="/dashboard/vehicle-intelligence#fleet-alerts"><i>△</i><span>Fleet alerts</span></Link><Link href="/dashboard/vehicle-intelligence#maintenance"><i>⌁</i><span>Maintenance</span></Link></nav><Link className="intel-add-asset" href="/dashboard/fleet/new?from=intelligence">＋ Add vehicle</Link></aside><div className="intel-world-stage"><header className="intel-world-bar"><strong>Vehicle Pulse</strong><Link href="/dashboard/vehicle-intelligence">Back to Fleet Brain</Link></header><main className="intelligence-page"><PulseClient vehicles={hydrated}/></main></div></div>;
}
