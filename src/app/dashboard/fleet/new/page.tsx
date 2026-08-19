import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VinForm from "./vin-form";

export default async function NewVehiclePage({searchParams}:{searchParams:Promise<{error?:string;from?:string}>}){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {error,from}=await searchParams;
  const fromLaunch=from==="launch";
  const backHref=fromLaunch?"/launch?edit=1&step=fleet":"/dashboard/vehicle-intelligence";
  return <main className="shell">
    <header className="topbar"><Link className="brand" href={backHref}>Check<i>✓</i>Calling</Link><Link className="button secondary" href={backHref}>{fromLaunch?"Back to Fleet Setup":"Back to Vehicle Intelligence"}</Link></header>
    <section className="card" style={{maxWidth:760,margin:"30px auto"}}><div className="eyebrow">Fleet onboarding · Vehicle intake</div><h1 style={{fontSize:44}}>Add a verified vehicle</h1><p className="lede">Decode by VIN or enter the vehicle manually, then add the images used throughout Vehicle Intelligence.</p><VinForm initialError={error} returnToLaunch={fromLaunch}/></section>
  </main>;
}
