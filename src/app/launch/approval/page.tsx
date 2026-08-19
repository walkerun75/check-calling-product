import Link from "next/link";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import ApprovalForm, { type ApprovalRules } from "./approval-form";
import "./approval.css";

export default async function ApprovalSetupPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");
  const { data: step } = await supabase.from("organization_launch_steps").select("configuration,status").eq("organization_id", membership.organization_id).eq("step_key", "approval").single();
  const configuration = (step?.configuration ?? {}) as { approvalRules?: ApprovalRules };
  return <main className="approval-page"><header className="approval-top"><Link href="/launch?edit=1&step=approval" className="approval-brand">Check<i>✓</i>Calling</Link><strong>Renter Evaluation</strong><div className="approval-search">⌕ Search... <kbd>Ctrl K</kbd></div><b>4/8 setup · {step?.status?.replace("_", " ")}</b></header><div className="approval-workspace"><Link className="approval-back" href="/launch?edit=1&step=approval">← Back to setup</Link><section className="approval-heading"><div><span>Approval rules · Setup 4</span><h1>Renter Evaluation</h1><p>Define the verified requirements and review controls used to generate explainable rental recommendations.</p></div><aside><strong>Policy—not hidden judgment</strong><p>The rules engine evaluates saved host requirements first. AI explains the result and proposes next actions.</p></aside></section>{params.saved&&<div className="approval-success" role="status">Evaluation rules saved. Return to setup when you are ready to mark this step complete.</div>}{params.error&&<div className="approval-error" role="alert">{params.error}</div>}<ApprovalForm rules={configuration.approvalRules ?? {}}/></div></main>;
}
