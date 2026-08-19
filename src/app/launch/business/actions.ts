"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function businessConfiguration() {
  const context = await getLaunchContext();
  if (!["owner","admin"].includes(context.membership.role)) redirect("/dashboard/command-center");
  const {data} = await context.supabase.from("organization_launch_steps").select("configuration")
    .eq("organization_id",context.membership.organization_id).eq("step_key","business").single();
  return {...context,configuration:(data?.configuration ?? {}) as Record<string,unknown>};
}

export async function saveCompanyInformation(formData:FormData) {
  const {supabase,membership,configuration} = await businessConfiguration();
  const company = {
    name:String(formData.get("name")??"").trim(), location:String(formData.get("location")??"").trim(),
    supportEmail:String(formData.get("supportEmail")??"").trim(), phone:String(formData.get("phone")??"").trim(),
    hours:String(formData.get("hours")??"").trim(), operationsLead:String(formData.get("operationsLead")??"").trim(),
  };
  if (!company.name || !company.location || !company.supportEmail) redirect("/launch/business?view=company&error=Complete the required company fields");
  await supabase.from("organization_launch_steps").update({configuration:{...configuration,company},status:"in_progress",updated_at:new Date().toISOString(),completed_by:null,completed_at:null})
    .eq("organization_id",membership.organization_id).eq("step_key","business");
  revalidatePath("/launch/business"); revalidatePath("/launch");
  redirect("/launch/business?view=company&saved=1");
}

export async function addTeamInvitation(formData:FormData) {
  const {supabase,membership,configuration} = await businessConfiguration();
  const email=String(formData.get("email")??"").trim().toLowerCase();
  const firstName=String(formData.get("firstName")??"").trim();
  const lastName=String(formData.get("lastName")??"").trim();
  const fullName=`${firstName} ${lastName}`.trim();
  const permissions=formData.getAll("permissions").map(String);
  if (!email || !email.includes("@") || !firstName || !lastName) redirect("/launch/business?error=Enter a first name, last name, and valid email address");
  if (!permissions.length) redirect("/launch/business?error=Select at least one permission for this team member");
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) redirect("/launch/business?error=Email invitations are not configured");
  const admin=createAdminClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const siteUrl=process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const {data:inviteData,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{
    redirectTo:`${siteUrl}/auth/callback?next=/auth/set-password`,
    data:{full_name:fullName,organization_id:membership.organization_id,role:"host",permissions},
  });
  if (inviteError || !inviteData.user) redirect(`/launch/business?error=${encodeURIComponent(inviteError?.message ?? "The invitation could not be sent")}`);
  const {error:profileError}=await admin.from("profiles").upsert({id:inviteData.user.id,full_name:fullName,updated_at:new Date().toISOString()});
  const {error:memberError}=await admin.from("organization_members").upsert({organization_id:membership.organization_id,user_id:inviteData.user.id,role:"host"});
  if (profileError || memberError) redirect(`/launch/business?error=${encodeURIComponent(profileError?.message ?? memberError?.message ?? "The teammate account could not be assigned")}`);
  const invitations=Array.isArray(configuration.invitations)?configuration.invitations as Record<string,unknown>[]:[];
  const next=[...invitations.filter(item=>item.email!==email),{email,fullName,firstName,lastName,userId:inviteData.user.id,role:"host",permissions,status:"invited",createdAt:new Date().toISOString()}];
  await supabase.from("organization_launch_steps").update({configuration:{...configuration,invitations:next},status:"in_progress",updated_at:new Date().toISOString(),completed_by:null,completed_at:null})
    .eq("organization_id",membership.organization_id).eq("step_key","business");
  revalidatePath("/launch/business"); revalidatePath("/launch");
  redirect("/launch/business?invited=1");
}

export async function removeTeamInvitation(formData:FormData) {
  const {supabase,membership,configuration} = await businessConfiguration();
  const email=String(formData.get("email")??"");
  const invitations=Array.isArray(configuration.invitations)?configuration.invitations as Record<string,unknown>[]:[];
  await supabase.from("organization_launch_steps").update({configuration:{...configuration,invitations:invitations.filter(item=>item.email!==email)},updated_at:new Date().toISOString()})
    .eq("organization_id",membership.organization_id).eq("step_key","business");
  revalidatePath("/launch/business"); redirect("/launch/business");
}
