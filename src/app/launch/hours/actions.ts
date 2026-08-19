"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

export async function saveOperatingHours(formData: FormData) {
  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");

  const days = formData.getAll("day").map(String);
  const from = formData.getAll("from").map(String);
  const until = formData.getAll("until").map(String);
  const schedule = days.map((day, index) => ({ day, from: from[index], until: until[index] }))
    .filter((row) => row.day && row.from && row.until);
  if (!schedule.length) redirect("/launch/hours?error=Add at least one complete operating-hours row");

  const { data: step } = await supabase.from("organization_launch_steps").select("configuration")
    .eq("organization_id", membership.organization_id).eq("step_key", "rules").single();
  const configuration = (step?.configuration ?? {}) as Record<string, unknown>;
  const operatingHours = {
    orderSource: String(formData.get("orderSource") ?? "booking-page"),
    onlineReservations: formData.get("onlineReservations") === "on",
    hostedStore: formData.get("hostedStore") === "on",
    showPrices: formData.get("showPrices") === "on",
    existingWebsiteUrl: String(formData.get("existingWebsiteUrl") ?? ""),
    integrationReturnUrl: String(formData.get("integrationReturnUrl") ?? ""),
    enabled: formData.get("hoursEnabled") === "on",
    defaultPickupTime: String(formData.get("defaultPickupTime") ?? "08:00"),
    schedule,
    preventLastMinute: formData.get("preventLastMinute") === "on",
    awayMode: formData.get("awayMode") === "on",
    requireApproval: formData.get("requireApproval") === "on",
    cancellation: String(formData.get("cancellation") ?? "not-allowed"),
  };

  await supabase.from("organization_launch_steps").update({
    configuration: { ...configuration, operatingHours },
    status: "in_progress",
    completed_by: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  }).eq("organization_id", membership.organization_id).eq("step_key", "rules");
  revalidatePath("/launch/hours");
  revalidatePath("/launch");
  redirect("/launch/hours?saved=1");
}
