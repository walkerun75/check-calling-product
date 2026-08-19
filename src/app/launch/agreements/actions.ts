"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";

export async function saveAgreementRules(formData:FormData){
  const {supabase,membership}=await getLaunchContext();if(!["owner","admin"].includes(membership.role))redirect("/dashboard/command-center");
  const source=String(formData.get("agreementSource")??"stock");let uploadedAgreement:Record<string,string>|null=null;
  const file=formData.get("agreementFile");
  if(source==="upload"&&file instanceof File&&file.size){
    if(file.size>10*1024*1024)redirect("/launch/agreements?error=Agreement files must be 10 MB or smaller");
    const allowed=["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if(!allowed.includes(file.type))redirect("/launch/agreements?error=Upload a PDF or DOCX agreement");
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${membership.organization_id}/${Date.now()}-${safeName}`;
    const {error:uploadError}=await supabase.storage.from("agreement-templates").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError)redirect(`/launch/agreements?error=${encodeURIComponent(uploadError.message)}`);
    uploadedAgreement={path,name:file.name,type:file.type};
  }
  const agreementRules={source,stockTemplate:String(formData.get("stockTemplate")??"standard"),companyName:String(formData.get("companyName")??"").trim(),jurisdiction:String(formData.get("jurisdiction")??"").trim(),lateFee:String(formData.get("lateFee")??"").trim(),mileageAllowance:String(formData.get("mileageAllowance")??"").trim(),fuelPolicy:String(formData.get("fuelPolicy")??"same_level"),customTerms:String(formData.get("customTerms")??"").trim(),signatureProvider:String(formData.get("signatureProvider")??"check_calling"),sendTiming:String(formData.get("sendTiming")??"approval"),reminderHours:Number(formData.get("reminderHours")??24),requireSignature:formData.get("requireSignature")==="on",requirePayment:formData.get("requirePayment")==="on",requireDeposit:formData.get("requireDeposit")==="on",requireInspection:formData.get("requireInspection")==="on",includeEvaluationSummary:formData.get("includeEvaluationSummary")==="on",uploadedAgreement};
  const {data:step}=await supabase.from("organization_launch_steps").select("configuration").eq("organization_id",membership.organization_id).eq("step_key","agreements").single();
  const configuration=(step?.configuration??{}) as Record<string,unknown>;const previous=(configuration.agreementRules??{}) as {uploadedAgreement?:unknown};
  if(source==="upload"&&!uploadedAgreement&&!previous.uploadedAgreement)redirect("/launch/agreements?error=Choose a PDF or DOCX agreement before saving");
  if(!uploadedAgreement&&previous.uploadedAgreement)agreementRules.uploadedAgreement=previous.uploadedAgreement as Record<string,string>;
  const {error}=await supabase.from("organization_launch_steps").update({configuration:{...configuration,agreementRules},status:"in_progress",completed_by:null,completed_at:null,updated_at:new Date().toISOString()}).eq("organization_id",membership.organization_id).eq("step_key","agreements");
  if(error)redirect(`/launch/agreements?error=${encodeURIComponent(error.message)}`);revalidatePath("/launch/agreements");revalidatePath("/launch");redirect("/launch/agreements?saved=1");
}
