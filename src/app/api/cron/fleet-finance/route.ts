import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:run}=await supabase.from("fleet_finance_runs").insert({status:"running"}).select("id").single();
 const today=new Date(),monthStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)).toISOString().slice(0,10);
 const {data:rules,error}=await supabase.from("fleet_finance_rules").select("id,organization_id,vehicle_id,name,category,amount,day_of_month,vendor,description,last_posted_month,created_by").eq("enabled",true).lte("day_of_month",today.getUTCDate());
 if(error){if(run)await supabase.from("fleet_finance_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:error.message}).eq("id",run.id);return NextResponse.json({error:error.message},{status:500});}let posted=0,failed=0;
 for(const rule of rules??[]){if(rule.last_posted_month&&rule.last_posted_month>=monthStart)continue;const sourceKey=`recurring:${rule.id}:${monthStart}`;const {error:insertError}=await supabase.from("fleet_financial_entries").insert({organization_id:rule.organization_id,vehicle_id:rule.vehicle_id,entry_date:new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),rule.day_of_month)).toISOString().slice(0,10),category:rule.category,amount:rule.amount,description:rule.description||rule.name,vendor:rule.vendor,payment_method:"other",reference_number:"",source:"recurring_rule",source_key:sourceKey,created_by:rule.created_by});if(insertError){if(insertError.code!=="23505")failed++;continue;}await supabase.from("fleet_finance_rules").update({last_posted_month:monthStart,updated_at:new Date().toISOString()}).eq("id",rule.id);posted++;}
 if(run)await supabase.from("fleet_finance_runs").update({status:failed?"partial":"success",completed_at:new Date().toISOString(),rules_checked:rules?.length??0,entries_posted:posted,entries_failed:failed}).eq("id",run.id);
 return NextResponse.json({ok:true,posted,failed,checked:rules?.length??0});
}
