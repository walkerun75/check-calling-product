"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

export async function resolveRenterEvaluation(formData: FormData) {
  const id = String(formData.get("evaluationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const allowed = ["approved","conditionally_approved","declined","information_requested"];
  if (!id || !allowed.includes(decision)) redirect("/dashboard/decisions?error=Invalid decision");
  const { supabase, user, membership } = await getLaunchContext();
  if (!["owner","admin","host"].includes(membership.role)) redirect("/dashboard/command-center");
  const { error } = await supabase.from("renter_evaluations").update({ status:decision, decided_by:user.id, decided_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id",id).eq("organization_id",membership.organization_id);
  if (error) redirect(`/dashboard/decisions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/decisions"); revalidatePath("/dashboard/command-center");
  redirect("/dashboard/decisions?resolved=1");
}
