"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

export async function savePaymentRules(formData: FormData) {
  const { supabase, membership } = await getLaunchContext();
  if (!["owner","admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const taxNames = formData.getAll("taxName").map(String);
  const taxRates = formData.getAll("taxRate").map(Number);
  const taxApplies = formData.getAll("taxAppliesTo").map(String);
  const taxProfiles = taxNames.map((name,index)=>({ name:name.trim(), rate:taxRates[index], appliesTo:taxApplies[index] || "rental" })).filter(item=>item.name && Number.isFinite(item.rate) && item.rate >= 0 && item.rate <= 100);
  const baseDeposit = Number(formData.get("baseDeposit"));
  const damageHold = Number(formData.get("damageHold"));
  if (baseDeposit < 0 || damageHold < 0) redirect("/launch/payments?error=Deposit and authorization amounts cannot be negative");
  const paymentRules = {
    provider: String(formData.get("provider") ?? "stripe"), currency: String(formData.get("currency") ?? "USD"),
    rentalBilling: String(formData.get("rentalBilling") ?? "per_rental"),
    acceptCards: formData.get("acceptCards") === "on", acceptWallets: formData.get("acceptWallets") === "on",
    automaticReceipts: formData.get("automaticReceipts") === "on", payoutSchedule: String(formData.get("payoutSchedule") ?? "daily"),
    baseDeposit, damageHold, captureTiming: String(formData.get("captureTiming") ?? "booking"),
    taxInclusive: formData.get("taxInclusive") === "on", defaultTaxProfile: String(formData.get("defaultTaxProfile") ?? ""), taxProfiles,
    requireProtectionChoice: formData.get("requireProtectionChoice") === "on", allowPersonalInsurance: formData.get("allowPersonalInsurance") === "on",
    protectionPlan: String(formData.get("protectionPlan") ?? "standard"), incidentDeductible: Number(formData.get("incidentDeductible") ?? 0),
  };
  const { data:step } = await supabase.from("organization_launch_steps").select("configuration").eq("organization_id",membership.organization_id).eq("step_key","payments").single();
  const configuration = (step?.configuration ?? {}) as Record<string,unknown>;
  const { error } = await supabase.from("organization_launch_steps").update({ configuration:{...configuration,paymentRules}, status:"in_progress", completed_by:null, completed_at:null, updated_at:new Date().toISOString() }).eq("organization_id",membership.organization_id).eq("step_key","payments");
  if (error) redirect(`/launch/payments?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/launch/payments"); revalidatePath("/launch"); redirect("/launch/payments?saved=1");
}
