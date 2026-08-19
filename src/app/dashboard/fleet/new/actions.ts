"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createVehicle(formData: FormData) {
  const returnToLaunch = String(formData.get("returnToLaunch")) === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).single();
  if (!membership) redirect("/dashboard/fleet/new?error=No+organization+membership+was+found.");
  const entryMode = String(formData.get("entry_mode") ?? "vin");
  const vinInput = String(formData.get("vin") ?? "").toUpperCase().trim();
  const vin = vinInput || `MANUAL${crypto.randomUUID().replaceAll("-", "").slice(0, 11).toUpperCase()}`;
  const dailyRate = String(formData.get("daily_rate") ?? "").trim();
  const { data: createdVehicle, error } = await supabase.from("vehicles").insert({
    organization_id:membership.organization_id, created_by:user.id, vin,
    year:Number(formData.get("year")) || null, make:String(formData.get("make") ?? "").trim(),
    model:String(formData.get("model") ?? "").trim(), trim:String(formData.get("trim") ?? "").trim() || null,
    license_plate:String(formData.get("license_plate") ?? "").trim() || null,
    odometer:Number(formData.get("odometer")) || null, daily_rate:dailyRate ? Number(dailyRate) : null,
    status:"draft", source:entryMode === "manual" ? "manual" : "vin_decode",
  }).select("id").single();
  if (error) redirect(`/dashboard/fleet/new?${returnToLaunch?"from=launch&":""}error=${encodeURIComponent(error.message)}`);
  if (!createdVehicle) redirect(`/dashboard/fleet/new?${returnToLaunch?"from=launch&":""}error=Vehicle+record+was+not+returned.`);
  const imageFiles = formData.getAll("vehicle_images").filter((item): item is File => item instanceof File && item.size > 0);
  for (let index = 0; index < imageFiles.length; index++) {
    const file = imageFiles[index];
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${membership.organization_id}/${createdVehicle.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(storagePath, file, { contentType:file.type, upsert:false });
    if (uploadError) continue;
    const { data: publicUrl } = supabase.storage.from("vehicle-photos").getPublicUrl(storagePath);
    await supabase.from("vehicle_photos").insert({ organization_id:membership.organization_id, vehicle_id:createdVehicle.id, storage_path:storagePath, public_url:publicUrl.publicUrl, alt_text:`${String(formData.get("year")??"")} ${String(formData.get("make")??"")} ${String(formData.get("model")??"")} vehicle photo`.trim(), is_primary:index===0, sort_order:index });
  }
  if (returnToLaunch) {
    await supabase.from("organization_launch_steps").update({status:"in_progress",completed_by:null,completed_at:null,updated_at:new Date().toISOString()})
      .eq("organization_id",membership.organization_id).eq("step_key","fleet");
    redirect("/launch/fleet?created=1");
  }
  redirect(`/dashboard/vehicle-intelligence?created=${createdVehicle.id}`);
}
