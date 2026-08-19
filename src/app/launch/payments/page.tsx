import Link from "next/link";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import PaymentsForm,{type PaymentRules} from "./payments-form";
import "./payments.css";
import "./section-colors.css";

export default async function PaymentsSetupPage({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}){
  const params=await searchParams;const {supabase,membership}=await getLaunchContext();if(!["owner","admin"].includes(membership.role))redirect("/dashboard/command-center");
  const {data:step}=await supabase.from("organization_launch_steps").select("configuration,status").eq("organization_id",membership.organization_id).eq("step_key","payments").single();
  const configuration=(step?.configuration??{}) as {paymentRules?:PaymentRules};
  return <main className="payments-page"><header className="payments-top"><Link href="/launch?edit=1&step=payments">Check<i>✓</i>Calling</Link><strong>Payments, Taxes &amp; Protection</strong><div>⌕ Search... <kbd>Ctrl K</kbd></div><b>5/8 setup · {step?.status?.replace("_"," ")}</b></header><div className="payments-workspace"><Link className="payments-back" href="/launch?edit=1&step=payments">← Back to setup</Link><section className="payments-heading"><div><span>Financial operations · Setup 5</span><h1>Payments, Taxes &amp; Protection</h1><p>Configure how the business collects money, applies taxes, authorizes deposits, sends payouts, and protects each rental.</p></div><aside><strong>Secure connection model</strong><p>Account authorization is handled by the payment provider. Check Calling never asks hosts to paste private payment keys into this setup.</p></aside></section>{params.saved&&<div className="payments-success">Financial rules saved. Return to setup when you are ready to mark this step complete.</div>}{params.error&&<div className="payments-error">{params.error}</div>}<PaymentsForm rules={configuration.paymentRules??{}}/></div></main>;
}
