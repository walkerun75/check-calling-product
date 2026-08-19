"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

const launchPositions: Record<string,number> = {
  business:1, rules:2, fleet:3, approval:4,
  payments:5, agreements:6, website:7, launch:8,
};

export async function updateLaunchStep(formData: FormData) {
  const stepKey = String(formData.get("stepKey") ?? "");
  const intent = String(formData.get("intent") ?? "start");
  const { supabase, user, membership } = await getLaunchContext();
  if (!["owner","admin"].includes(membership.role)) redirect("/dashboard/command-center");
  if (intent === "edit") {
    await supabase.from("organization_launch_steps").update({
      status:"in_progress", updated_at:new Date().toISOString(), completed_by:null, completed_at:null,
    }).eq("organization_id",membership.organization_id).eq("step_key",stepKey);
    revalidatePath("/launch");
    redirect(stepKey === "business" ? "/launch/business" : stepKey === "rules" ? "/launch/hours" : stepKey === "fleet" ? "/launch/fleet" : stepKey === "approval" ? "/launch/approval" : stepKey === "payments" ? "/launch/payments" : stepKey === "agreements" ? "/launch/agreements" : stepKey === "website" ? "/launch/website" : stepKey === "launch" ? "/launch/check" : `/launch?edit=1&mode=edit&step=${stepKey}`);
  }
  const status = intent === "complete" ? "complete" : "in_progress";
  if (stepKey === "fleet" && status === "complete") {
    const { count } = await supabase.from("vehicles").select("id", { count:"exact", head:true })
      .eq("organization_id", membership.organization_id);
    if (!count) redirect("/launch?edit=1&step=fleet&error=Add at least one verified vehicle before completing Fleet Setup");
  }
  if (stepKey === "launch" && status === "complete") {
    const { data: requiredSteps } = await supabase.from("organization_launch_steps")
      .select("step_key,status,configuration")
      .eq("organization_id", membership.organization_id)
      .neq("step_key", "launch");
    const requiredConfiguration: Record<string, string | null> = {
      business: null,
      rules: "operatingHours",
      fleet: null,
      approval: "approvalRules",
      payments: "paymentRules",
      agreements: "agreementRules",
      website: "websiteSettings",
    };
    const invalidStep = requiredSteps?.find((step) => {
      const configKey = requiredConfiguration[step.step_key];
      const configuration = (step.configuration ?? {}) as Record<string, unknown>;
      return step.status !== "complete" || Boolean(configKey && !configuration[configKey]);
    });
    const { count: vehicleCount } = await supabase.from("vehicles")
      .select("id", { count:"exact", head:true })
      .eq("organization_id", membership.organization_id);
    if ((requiredSteps?.length ?? 0) !== 7 || invalidStep || !vehicleCount) {
      redirect("/launch/check?error=Resolve all required setup items before completing Launch Check");
    }
  }
  const position = launchPositions[stepKey];
  if (!position) redirect("/launch?error=Unknown setup step");
  const { error:updateError } = await supabase.from("organization_launch_steps").upsert({
    organization_id: membership.organization_id, step_key:stepKey, position, status,
    updated_at:new Date().toISOString(), completed_by:status === "complete" ? user.id : null,
    completed_at:status === "complete" ? new Date().toISOString() : null,
  }, { onConflict:"organization_id,step_key" });
  if (updateError) redirect(`/launch?edit=1&step=${stepKey}&error=${encodeURIComponent(updateError.message)}`);
  revalidatePath("/launch");
  revalidatePath("/dashboard/command-center");
  if (stepKey === "business" && status === "in_progress") redirect("/launch/business");
  if (stepKey === "rules" && status === "in_progress") redirect("/launch/hours");
  if (stepKey === "fleet" && status === "in_progress") redirect("/launch/fleet");
  if (stepKey === "approval" && status === "in_progress") redirect("/launch/approval");
  if (stepKey === "payments" && status === "in_progress") redirect("/launch/payments");
  if (stepKey === "agreements" && status === "in_progress") redirect("/launch/agreements");
  if (stepKey === "website" && status === "in_progress") redirect("/launch/website");
  if (stepKey === "launch" && status === "in_progress") redirect("/launch/check");
  if (status === "complete") {
    const { data: steps } = await supabase.from("organization_launch_steps")
      .select("step_key,status,position").eq("organization_id", membership.organization_id).order("position");
    const next = steps?.find(step => step.status !== "complete");
    redirect(next ? `/launch?edit=1&step=${next.step_key}&completed=${stepKey}` : "/launch?edit=1&step=launch&completed=launch");
  }
}

export async function activatePlatform() {
  const { supabase, membership } = await getLaunchContext();
  if (!["owner","admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const { count } = await supabase.from("organization_launch_steps").select("*", { count:"exact", head:true })
    .eq("organization_id", membership.organization_id).eq("status", "complete");
  if (count !== 8) redirect("/launch?error=Complete all 8 launch steps before activation");
  await supabase.from("organizations").update({ launch_status:"active", launched_at:new Date().toISOString() })
    .eq("id", membership.organization_id);
  redirect("/dashboard/command-center");
}
