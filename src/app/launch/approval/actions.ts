"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

export async function saveApprovalRules(formData: FormData) {
  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const minimumAge = Number(formData.get("minimumAge"));
  const minimumInsuranceCoverage = Number(formData.get("minimumInsuranceCoverage"));
  const baseDeposit = Number(formData.get("baseDeposit"));
  if (!Number.isInteger(minimumAge) || minimumAge < 18 || minimumAge > 100) redirect("/launch/approval?error=Enter a valid minimum renter age");
  if (minimumInsuranceCoverage < 0 || baseDeposit < 0) redirect("/launch/approval?error=Coverage and deposit values cannot be negative");

  const rules = {
    minimumAge,
    requireIdentity: formData.get("requireIdentity") === "on",
    requireLicense: formData.get("requireLicense") === "on",
    requireInsurance: formData.get("requireInsurance") === "on",
    minimumInsuranceCoverage,
    requirePaymentMethod: formData.get("requirePaymentMethod") === "on",
    requireDepositAuthorization: formData.get("requireDepositAuthorization") === "on",
    baseDeposit,
    considerDrivingRecord: formData.get("considerDrivingRecord") === "on",
    considerRentalHistory: formData.get("considerRentalHistory") === "on",
    considerPaymentReliability: formData.get("considerPaymentReliability") === "on",
    considerVehicleRisk: formData.get("considerVehicleRisk") === "on",
    incompleteDataAction: String(formData.get("incompleteDataAction") ?? "manual_review"),
    conflictingDataAction: String(formData.get("conflictingDataAction") ?? "manual_review"),
    autoApprovalThreshold: Number(formData.get("autoApprovalThreshold") ?? 90),
    aiRecommendations: formData.get("aiRecommendations") === "on",
    requireHostConfirmation: formData.get("requireHostConfirmation") === "on",
  };
  const { data: step } = await supabase.from("organization_launch_steps").select("configuration")
    .eq("organization_id", membership.organization_id).eq("step_key", "approval").single();
  const configuration = (step?.configuration ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("organization_launch_steps").update({
    configuration: { ...configuration, approvalRules: rules }, status: "in_progress",
    completed_by: null, completed_at: null, updated_at: new Date().toISOString(),
  }).eq("organization_id", membership.organization_id).eq("step_key", "approval");
  if (error) redirect(`/launch/approval?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/launch/approval"); revalidatePath("/launch");
  redirect("/launch/approval?saved=1");
}
