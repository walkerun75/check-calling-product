"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const licensePlate = String(formData.get("license_plate") ?? "").trim();
  const odometer = Number(formData.get("odometer"));
  const dailyRate = Number(formData.get("daily_rate"));
  const requestedReady = formData.get("mark_ready") === "yes";
  const complete = Boolean(licensePlate && odometer >= 0 && dailyRate > 0);
  if (requestedReady && !complete) redirect(`/dashboard/fleet/${vehicleId}?error=Complete+the+license+plate,+odometer,+and+daily+rate+before+marking+the+vehicle+ready.`);
  const { error } = await supabase.from("vehicles").update({ license_plate:licensePlate || null, odometer:Number.isFinite(odometer) ? odometer : null, daily_rate:Number.isFinite(dailyRate) ? dailyRate : null, status:requestedReady ? "ready" : "draft", updated_at:new Date().toISOString() }).eq("id", vehicleId);
  if (error) redirect(`/dashboard/fleet/${vehicleId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/fleet/${vehicleId}?saved=1`);
}

