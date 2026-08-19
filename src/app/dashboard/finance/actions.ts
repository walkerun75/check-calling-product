"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const categories = new Set(["rental_income","cleaning","maintenance","repair","insurance","registration_tax","fuel_charging","financing","tolls_parking","vehicle_investment"]);
const paymentMethods = new Set(["cash","card","bank_transfer","platform","financing","other"]);
const receiptTypes = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);

export async function addFleetFinancialEntry(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["owner", "admin", "host"].includes(membership.role)) redirect("/dashboard/finance?error=You+do+not+have+permission+to+add+fleet+entries.");
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount"));
  const entryDate = String(formData.get("entry_date") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const referenceNumber = String(formData.get("reference_number") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "other");
  let receiptUrl = String(formData.get("receipt_url") ?? "").trim();
  const receipt = formData.get("receipt_file");
  if (!vehicleId || !categories.has(category) || !entryDate || !Number.isFinite(amount) || amount <= 0) redirect("/dashboard/finance?error=Select+a+vehicle+and+enter+a+valid+date,+category,+and+amount.");
  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("organization_id", membership.organization_id).maybeSingle();
  if (!vehicle) redirect("/dashboard/finance?error=The+selected+vehicle+does+not+belong+to+this+fleet.");
  if(!paymentMethods.has(paymentMethod)) redirect("/dashboard/finance?error=Select+a+valid+payment+method.");
  if(receipt instanceof File && receipt.size>0){
    if(receipt.size>10*1024*1024||!receiptTypes.has(receipt.type)) redirect("/dashboard/finance?error=Receipt+must+be+a+JPG,+PNG,+WebP,+or+PDF+under+10+MB.");
    const extension=(receipt.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const receiptPath=`${membership.organization_id}/${vehicleId}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await supabase.storage.from("fleet-finance-receipts").upload(receiptPath,receipt,{contentType:receipt.type,upsert:false});
    if(uploadError) redirect(`/dashboard/finance?error=${encodeURIComponent(`Receipt upload failed: ${uploadError.message}`)}`);
    receiptUrl=receiptPath;
  }
  const { error } = await supabase.from("fleet_financial_entries").insert({ organization_id: membership.organization_id, vehicle_id: vehicleId, entry_date: entryDate, category, amount, description, vendor, reference_number:referenceNumber, payment_method:paymentMethod, receipt_url:receiptUrl||null, created_by: user.id });
  if (error) redirect(`/dashboard/finance?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/vehicle-intelligence");
  revalidatePath("/dashboard/command-center");
  redirect("/dashboard/finance?saved=1");
}

export async function updateFleetFinancialEntry(entryId:string,formData:FormData){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership||!["owner","admin","host"].includes(membership.role)) redirect("/dashboard/finance?error=You+do+not+have+permission+to+edit+fleet+entries.");
  const category=String(formData.get("category")??""); const amount=Number(formData.get("amount")); const description=String(formData.get("description")??"").trim();
  if(!categories.has(category)||!Number.isFinite(amount)||amount<=0) redirect("/dashboard/finance?error=Enter+a+valid+category+and+amount.");
  const {error}=await supabase.from("fleet_financial_entries").update({category,amount,description,vendor:String(formData.get("vendor")??"").trim(),reference_number:String(formData.get("reference_number")??"").trim(),payment_method:String(formData.get("payment_method")??"other"),updated_at:new Date().toISOString()}).eq("id",entryId).eq("organization_id",membership.organization_id);
  if(error) redirect(`/dashboard/finance?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/finance"); revalidatePath("/dashboard/vehicle-intelligence");
  redirect("/dashboard/finance?saved=updated");
}

export async function deleteFleetFinancialEntry(entryId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("fleet_financial_entries").delete().eq("id", entryId);
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/vehicle-intelligence");
  redirect("/dashboard/finance?deleted=1");
}

export async function addFinanceAutomationRule(formData:FormData){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership||!["owner","admin","host"].includes(membership.role))redirect("/dashboard/finance?error=You+do+not+have+permission+to+create+automation+rules.");
  const vehicleId=String(formData.get("vehicle_id")??""),category=String(formData.get("category")??""),amount=Number(formData.get("amount")),dayOfMonth=Number(formData.get("day_of_month")),name=String(formData.get("name")??"").trim();
  if(!vehicleId||!name||!categories.has(category)||category==="rental_income"||!Number.isFinite(amount)||amount<=0||!Number.isInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>28)redirect("/dashboard/finance?error=Complete+the+automation+name,+vehicle,+cost,+amount,+and+monthly+day.");
  const {error}=await supabase.from("fleet_finance_rules").insert({organization_id:membership.organization_id,vehicle_id:vehicleId,name,category,amount,day_of_month:dayOfMonth,vendor:String(formData.get("vendor")??"").trim(),description:String(formData.get("description")??"").trim(),created_by:user.id});
  if(error)redirect(`/dashboard/finance?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard/finance");redirect("/dashboard/finance?saved=rule");
}

export async function toggleFinanceAutomationRule(ruleId:string,enabled:boolean){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();if(!membership||!["owner","admin","host"].includes(membership.role))redirect("/dashboard/finance?error=Permission+denied.");
  await supabase.from("fleet_finance_rules").update({enabled,updated_at:new Date().toISOString()}).eq("id",ruleId).eq("organization_id",membership.organization_id);revalidatePath("/dashboard/finance");redirect(`/dashboard/finance?saved=${enabled?"enabled":"paused"}`);
}

export async function updateFinanceAutomationRule(ruleId:string,formData:FormData){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership||!["owner","admin","host"].includes(membership.role))redirect("/dashboard/finance?error=Permission+denied.");
  const vehicleId=String(formData.get("vehicle_id")??""),name=String(formData.get("name")??"").trim(),category=String(formData.get("category")??""),amount=Number(formData.get("amount")),dayOfMonth=Number(formData.get("day_of_month")),vendor=String(formData.get("vendor")??"").trim();
  if(!vehicleId||!name||!categories.has(category)||category==="rental_income"||!Number.isFinite(amount)||amount<=0||!Number.isInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>28)redirect("/dashboard/finance?error=Complete+the+rule+name,+vehicle,+cost,+amount,+and+monthly+day.");
  const {data:vehicle}=await supabase.from("vehicles").select("id").eq("id",vehicleId).eq("organization_id",membership.organization_id).maybeSingle();
  if(!vehicle)redirect("/dashboard/finance?error=The+selected+vehicle+does+not+belong+to+this+fleet.");
  const {error}=await supabase.from("fleet_finance_rules").update({vehicle_id:vehicleId,name,category,amount,day_of_month:dayOfMonth,vendor,updated_at:new Date().toISOString()}).eq("id",ruleId).eq("organization_id",membership.organization_id);
  if(error)redirect(`/dashboard/finance?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard/finance");redirect("/dashboard/finance?saved=rule-updated");
}

export async function deleteFinanceAutomationRule(ruleId:string){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();
  if(!membership||!["owner","admin","host"].includes(membership.role))redirect("/dashboard/finance?error=Permission+denied.");
  const {error}=await supabase.from("fleet_finance_rules").delete().eq("id",ruleId).eq("organization_id",membership.organization_id);
  if(error)redirect(`/dashboard/finance?error=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard/finance");redirect("/dashboard/finance?deleted=rule");
}

export async function resolveFinanceInboxItem(itemId:string,decision:"approved"|"ignored",formData:FormData){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:membership}=await supabase.from("organization_members").select("organization_id,role").eq("user_id",user.id).limit(1).maybeSingle();if(!membership||!["owner","admin","host"].includes(membership.role))redirect("/dashboard/finance?error=Permission+denied.");
  const {data:item,error:itemError}=await supabase.from("fleet_finance_inbox").select("id,vehicle_id,source,source_key,transaction_date,amount,merchant,suggested_category,reason,status").eq("id",itemId).eq("organization_id",membership.organization_id).maybeSingle();
  if(itemError||!item||item.status!=="review")redirect("/dashboard/finance?error=This+review+item+is+no+longer+available.");
  if(decision==="approved"){
    const vehicleId=String(formData.get("vehicle_id")||item.vehicle_id||"");
    const category=String(formData.get("category")||item.suggested_category||"");
    if(!vehicleId||!categories.has(category))redirect("/dashboard/finance?error=Choose+a+vehicle+and+category+before+approving.");
    const {data:vehicle}=await supabase.from("vehicles").select("id").eq("id",vehicleId).eq("organization_id",membership.organization_id).maybeSingle();
    if(!vehicle)redirect("/dashboard/finance?error=The+selected+vehicle+does+not+belong+to+this+fleet.");
    const {error:insertError}=await supabase.from("fleet_financial_entries").insert({organization_id:membership.organization_id,vehicle_id:vehicleId,entry_date:item.transaction_date,category,amount:Math.abs(Number(item.amount)),description:item.reason||`Imported from ${item.source}`,vendor:item.merchant,reference_number:"",payment_method:"other",source:item.source,source_key:item.source_key||`inbox:${item.id}`,created_by:user.id});
    if(insertError&&insertError.code!=="23505")redirect(`/dashboard/finance?error=${encodeURIComponent(insertError.message)}`);
  }
  const {error:updateError}=await supabase.from("fleet_finance_inbox").update({status:decision,resolved_by:user.id,resolved_at:new Date().toISOString()}).eq("id",itemId).eq("organization_id",membership.organization_id);
  if(updateError)redirect(`/dashboard/finance?error=${encodeURIComponent(updateError.message)}`);
  revalidatePath("/dashboard/finance");revalidatePath("/dashboard/vehicle-intelligence");redirect(`/dashboard/finance?saved=${decision}`);
}
