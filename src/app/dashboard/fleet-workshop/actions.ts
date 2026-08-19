"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type WorkshopCheck = { key:string; label:string; group:string; status:"pending"|"passed"|"issue"; issueType?:string; issueNote?:string; issuePhotos?:string[] };
const defaultChecklist:WorkshopCheck[] = [
  {key:"mileage",label:"Record odometer and fuel or charge",group:"Check-in",status:"pending"},
  {key:"belongings",label:"Remove belongings, trash, and rental materials",group:"Interior",status:"pending"},
  {key:"interior",label:"Clean seats, surfaces, glass, and cargo area",group:"Interior",status:"pending"},
  {key:"odor",label:"Check for smoke, odor, stains, or interior damage",group:"Interior",status:"pending"},
  {key:"exterior",label:"Wash exterior and inspect body and windshield",group:"Exterior",status:"pending"},
  {key:"physical_damage",label:"Inspect and document physical vehicle damage",group:"Exterior",status:"pending"},
  {key:"tires",label:"Inspect tires, lights, and visible safety items",group:"Safety",status:"pending"},
  {key:"leaks",label:"Check warning lights, fluids, and visible leaks",group:"Safety",status:"pending"},
  {key:"keys",label:"Confirm keys, documents, and vehicle equipment",group:"Final review",status:"pending"},
];

function withRequiredChecks(checklist:WorkshopCheck[]){
  if(checklist.some(item=>item.key==="physical_damage")) return checklist;
  const damageCheck:WorkshopCheck={key:"physical_damage",label:"Inspect and document physical vehicle damage",group:"Exterior",status:"pending"};
  const exteriorIndex=checklist.findIndex(item=>item.key==="exterior");
  if(exteriorIndex<0) return [...checklist,damageCheck];
  return [...checklist.slice(0,exteriorIndex+1),damageCheck,...checklist.slice(exteriorIndex+1)];
}

async function context() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership) redirect("/login");
  return {supabase,user,membership};
}

function jobStatus(checklist:WorkshopCheck[], maintenanceHold=false){
  if(maintenanceHold) return "maintenance_hold";
  if(checklist.some(item=>item.status==="issue")) return "issue_found";
  return checklist.every(item=>item.status==="passed")?"final_review":"in_progress";
}

async function audit(supabase:Awaited<ReturnType<typeof createClient>>, organizationId:string, jobId:string, userId:string, eventType:string, details:Record<string,unknown>={}){
  await supabase.from("fleet_workshop_events").insert({organization_id:organizationId,workshop_job_id:jobId,actor_id:userId,event_type:eventType,details});
}

export async function createWorkshopJob(formData:FormData){
  const {supabase,user,membership}=await context();
  const vehicleId=String(formData.get("vehicle_id")??"");
  const dueAt=String(formData.get("due_at")??"")||null;
  const {data:vehicle}=await supabase.from("vehicles").select("id").eq("id",vehicleId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!vehicle) redirect("/dashboard/fleet-workshop?error=Select+a+valid+fleet+vehicle.");
  const {data:existing}=await supabase.from("fleet_workshop_jobs").select("id").eq("vehicle_id",vehicleId).not("status","in",'(\"completed\",\"ready\")').limit(1).maybeSingle();
  if(existing) redirect(`/dashboard/fleet-workshop?job=${existing.id}&error=This+vehicle+already+has+an+active+turnaround.`);
  const {data:job,error}=await supabase.from("fleet_workshop_jobs").insert({organization_id:membership.organization_id,vehicle_id:vehicleId,due_at:dueAt,assigned_to:user.id,created_by:user.id,checklist:defaultChecklist}).select("id").single();
  if(error) redirect(`/dashboard/fleet-workshop?error=${encodeURIComponent(error.message)}`);
  const {error:vehicleError}=await supabase.from("vehicles").update({status:"inactive",updated_at:new Date().toISOString()}).eq("id",vehicleId);
  if(vehicleError) redirect(`/dashboard/fleet-workshop?job=${job.id}&error=${encodeURIComponent(vehicleError.message)}`);
  await audit(supabase,membership.organization_id,job.id,user.id,"turnaround_started",{due_at:dueAt});
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/smart-calendar"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect(`/dashboard/fleet-workshop?job=${job.id}&started=1`);
}

export async function updateWorkshopCheck(jobId:string,itemKey:string,outcome:"passed"|"issue"){
  const {supabase,user,membership}=await context();
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("id,vehicle_id,checklist").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const currentChecklist=withRequiredChecks(job.checklist as WorkshopCheck[]);
  const currentItem=currentChecklist.find(item=>item.key===itemKey);
  if(itemKey==="physical_damage"&&outcome==="passed"&&currentItem?.status==="issue"&&!(currentItem.issuePhotos?.length)) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Upload+a+photo+of+the+physical+damage+before+clearing+this+inspection+issue.`);
  const checklist=currentChecklist.map(item=>item.key===itemKey
    ? outcome==="issue"
      ? {...item,status:outcome,issueType:undefined,issueNote:undefined}
      : {...item,status:outcome}
    : item);
  const status=jobStatus(checklist);
  const {error}=await supabase.from("fleet_workshop_jobs").update({checklist,status,started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"check_updated",{item_key:itemKey,outcome});
  revalidatePath("/dashboard/fleet-workshop");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=check`);
}

export async function saveWorkshopIssue(jobId:string,itemKey:string,formData:FormData){
  const {supabase,user,membership}=await context();
  const issueType=String(formData.get("issue_type")??"");
  const issueNote=String(formData.get("issue_note")??"").trim();
  if(!issueType||issueNote.length<2) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Select+an+issue+type+and+add+a+note.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("checklist").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const checklist=withRequiredChecks(job.checklist as WorkshopCheck[]).map(item=>item.key===itemKey?{...item,status:"issue" as const,issueType,issueNote}:item);
  const {error}=await supabase.from("fleet_workshop_jobs").update({checklist,status:"issue_found",updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"issue_saved",{item_key:itemKey,issue_type:issueType,note:issueNote});
  revalidatePath("/dashboard/fleet-workshop");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=issue`);
}

export async function saveInspectionReadings(jobId:string,formData:FormData){
  const {supabase,user,membership}=await context();
  const odometer=Number(formData.get("odometer"));
  const fuelLevel=Number(formData.get("fuel_level"));
  if(!Number.isInteger(odometer)||odometer<0||!Number.isInteger(fuelLevel)||fuelLevel<0||fuelLevel>100) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Enter+a+valid+odometer+and+a+fuel+or+charge+level+from+0+to+100.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id,checklist,status").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const checklist=withRequiredChecks(job.checklist as WorkshopCheck[]).map(item=>item.key==="mileage"?{...item,status:"passed" as const}:item);
  const {error}=await supabase.from("fleet_workshop_jobs").update({odometer,fuel_level:fuelLevel,checklist,status:jobStatus(checklist,job.status==="maintenance_hold"),started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  const {error:vehicleError}=await supabase.from("vehicles").update({odometer,updated_at:new Date().toISOString()}).eq("id",job.vehicle_id).eq("organization_id",membership.organization_id);
  if(vehicleError) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(vehicleError.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"readings_saved",{odometer,fuel_level:fuelLevel});
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=readings`);
}

export async function uploadIssuePhoto(jobId:string,itemKey:string,formData:FormData){
  const {supabase,user,membership}=await context();
  const file=formData.get("issue_photo");
  if(!(file instanceof File)||!file.size) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Choose+an+issue+photo.`);
  if(file.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Use+a+JPG,+PNG,+or+WebP+image+under+10+MB.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id,checklist").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=`${membership.organization_id}/${job.vehicle_id}/${jobId}/issues/${itemKey}-${Date.now()}.${extension}`;
  const {error:uploadError}=await supabase.storage.from("workshop-photos").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(uploadError.message)}`);
  const checklist=withRequiredChecks(job.checklist as WorkshopCheck[]).map(item=>item.key===itemKey?{...item,issuePhotos:[...(item.issuePhotos??[]),path]}:item);
  const {error}=await supabase.from("fleet_workshop_jobs").update({checklist,updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"issue_photo_uploaded",{item_key:itemKey,path});
  revalidatePath("/dashboard/fleet-workshop");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&photo=issue`);
}

export async function uploadReadyPhoto(jobId:string,formData:FormData){
  const {supabase,membership}=await context();
  const file=formData.get("ready_photo");
  if(!(file instanceof File)||!file.size) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Choose+a+clean-and-ready+photo.`);
  if(file.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Use+a+JPG,+PNG,+or+WebP+image+under+10+MB.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id,ready_photos").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=`${membership.organization_id}/${job.vehicle_id}/${jobId}/${Date.now()}.${extension}`;
  const {error}=await supabase.storage.from("workshop-photos").upload(path,file,{contentType:file.type,upsert:false});
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  const photos=[...((job.ready_photos as string[]|null)??[]),path];
  const {error:updateError}=await supabase.from("fleet_workshop_jobs").update({ready_photos:photos,updated_at:new Date().toISOString()}).eq("id",jobId);
  if(updateError) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(updateError.message)}`);
  await audit(supabase,membership.organization_id,jobId,(await supabase.auth.getUser()).data.user!.id,"ready_photo_uploaded",{path});
  revalidatePath("/dashboard/fleet-workshop");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&photo=1`);
}

export async function reportMaintenanceIssue(jobId:string,formData:FormData){
  const {supabase,user,membership}=await context();
  const summary=String(formData.get("summary")??"").trim();
  const severity=String(formData.get("severity")??"inspect");
  if(summary.length<2) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Describe+the+mechanical+issue.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const {error:workOrderError}=await supabase.from("maintenance_work_orders").insert({organization_id:membership.organization_id,vehicle_id:job.vehicle_id,workshop_job_id:jobId,severity,summary,created_by:user.id});
  if(workOrderError) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(workOrderError.message)}`);
  await Promise.all([
    supabase.from("fleet_workshop_jobs").update({status:"maintenance_hold",notes:summary,updated_at:new Date().toISOString()}).eq("id",jobId),
    supabase.from("vehicles").update({status:"maintenance",updated_at:new Date().toISOString()}).eq("id",job.vehicle_id),
  ]);
  await audit(supabase,membership.organization_id,jobId,user.id,"maintenance_hold_created",{severity,summary});
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/smart-calendar"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&hold=1`);
}

export async function resolveMaintenanceHold(jobId:string){
  const {supabase,user,membership}=await context();
  if(!["owner","admin","host"].includes(membership.role)) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Only+a+host+or+administrator+can+clear+a+maintenance+hold.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id,checklist").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const {error}=await supabase.from("maintenance_work_orders").update({status:"completed",completed_at:new Date().toISOString()}).eq("workshop_job_id",jobId).neq("status","completed");
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  const checklist=withRequiredChecks(job.checklist as WorkshopCheck[]);
  await supabase.from("fleet_workshop_jobs").update({checklist,status:jobStatus(checklist),updated_at:new Date().toISOString()}).eq("id",jobId);
  await supabase.from("vehicles").update({status:"inactive",updated_at:new Date().toISOString()}).eq("id",job.vehicle_id);
  await audit(supabase,membership.organization_id,jobId,user.id,"maintenance_hold_resolved");
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/smart-calendar"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=maintenance`);
}

export async function addWorkshopExpense(jobId:string,formData:FormData){
  const {supabase,user,membership}=await context();
  if(!["owner","admin","host"].includes(membership.role)) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Only+a+host+or+administrator+can+record+fleet+expenses.`);
  const category=String(formData.get("category")??"");
  const amount=Number(formData.get("amount"));
  const description=String(formData.get("description")??"").trim();
  if(!["maintenance","repair"].includes(category)||!Number.isFinite(amount)||amount<=0) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Choose+an+expense+type+and+enter+a+valid+amount.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const {error}=await supabase.from("fleet_financial_entries").insert({organization_id:membership.organization_id,vehicle_id:job.vehicle_id,entry_date:new Date().toISOString().slice(0,10),category,amount,description:description||`Fleet Workshop ${category}`,created_by:user.id});
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"expense_recorded",{category,amount,description});
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/finance"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=expense`);
}

export async function saveWorkshopProgress(jobId:string){
  const {supabase,user,membership}=await context();
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("id,checklist,status,odometer,fuel_level").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const {error}=await supabase.from("fleet_workshop_jobs").update({updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"progress_saved",{
    status:job.status,
    passed:(job.checklist as WorkshopCheck[]).filter(item=>item.status==="passed").length,
    total:(job.checklist as WorkshopCheck[]).length,
    odometer:job.odometer,
    fuel_level:job.fuel_level,
  });
  revalidatePath("/dashboard/fleet-workshop");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=progress`);
}

export async function updateWorkshopDueAt(jobId:string,formData:FormData){
  const {supabase,user,membership}=await context();
  const dueAt=String(formData.get("due_at")??"");
  if(!dueAt||Number.isNaN(new Date(dueAt).getTime())) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Choose+a+valid+ready-by+date+and+time.`);
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("id,vehicle_id").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const {error}=await supabase.from("fleet_workshop_jobs").update({due_at:dueAt,updated_at:new Date().toISOString()}).eq("id",jobId);
  if(error) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=${encodeURIComponent(error.message)}`);
  await audit(supabase,membership.organization_id,jobId,user.id,"ready_by_updated",{vehicle_id:job.vehicle_id,due_at:dueAt});
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/smart-calendar");
  redirect(`/dashboard/fleet-workshop?job=${jobId}&saved=due`);
}

export async function completeWorkshopJob(jobId:string){
  const {supabase,user,membership}=await context();
  const {data:job}=await supabase.from("fleet_workshop_jobs").select("vehicle_id,checklist,status,ready_photos").eq("id",jobId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!job) redirect("/dashboard/fleet-workshop?error=Workshop+job+not+found.");
  const checklist=withRequiredChecks(job.checklist as WorkshopCheck[]);
  if(job.status==="maintenance_hold"||checklist.some(item=>item.status!=="passed")) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Pass+every+required+check+before+releasing+the+vehicle.`);
  if(!Array.isArray(job.ready_photos)||!job.ready_photos.length) redirect(`/dashboard/fleet-workshop?job=${jobId}&error=Upload+a+clean-and-ready+photo+before+releasing+the+vehicle.`);
  await Promise.all([
    supabase.from("fleet_workshop_jobs").update({status:"completed",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",jobId),
    supabase.from("vehicles").update({status:"ready",updated_at:new Date().toISOString()}).eq("id",job.vehicle_id),
  ]);
  await audit(supabase,membership.organization_id,jobId,user.id,"vehicle_released");
  revalidatePath("/dashboard/fleet-workshop"); revalidatePath("/dashboard/smart-calendar"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect("/dashboard/fleet-workshop?completed=1");
}
