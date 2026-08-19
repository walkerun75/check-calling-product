"use client";

import { saveApprovalRules } from "./actions";

export type ApprovalRules = {
  minimumAge?: number; requireIdentity?: boolean; requireLicense?: boolean; requireInsurance?: boolean;
  minimumInsuranceCoverage?: number; requirePaymentMethod?: boolean; requireDepositAuthorization?: boolean;
  baseDeposit?: number; considerDrivingRecord?: boolean; considerRentalHistory?: boolean;
  considerPaymentReliability?: boolean; considerVehicleRisk?: boolean; incompleteDataAction?: string;
  conflictingDataAction?: string; autoApprovalThreshold?: number; aiRecommendations?: boolean;
  requireHostConfirmation?: boolean;
};

const Rule = ({ name, title, text, checked }: { name: string; title: string; text: string; checked: boolean }) => <label className="approval-rule"><input type="checkbox" name={name} defaultChecked={checked}/><span><strong>{title}</strong><small>{text}</small></span></label>;

export default function ApprovalForm({ rules }: { rules: ApprovalRules }) {
  return <form action={saveApprovalRules} className="approval-form">
    <section className="approval-card"><div className="approval-card-head"><div><span>Mandatory requirements</span><h2>Automatic eligibility gates</h2></div><em>Required</em></div><p>These checks must be satisfied before the policy can recommend automatic approval.</p><div className="approval-grid">
      <label className="approval-number"><span><strong>Minimum renter age</strong><small>Set the youngest eligible renter.</small></span><input name="minimumAge" type="number" min="18" max="100" defaultValue={rules.minimumAge ?? 21}/></label>
      <Rule name="requireIdentity" title="Verified identity" text="Identity provider must return a verified match." checked={rules.requireIdentity ?? true}/>
      <Rule name="requireLicense" title="Valid driver’s license" text="License must be valid and unexpired." checked={rules.requireLicense ?? true}/>
      <Rule name="requireInsurance" title="Insurance verification" text="Required coverage must be confirmed." checked={rules.requireInsurance ?? true}/>
      <label className="approval-number"><span><strong>Minimum insurance coverage</strong><small>Required liability coverage in dollars.</small></span><input name="minimumInsuranceCoverage" type="number" min="0" step="1000" defaultValue={rules.minimumInsuranceCoverage ?? 50000}/></label>
      <Rule name="requirePaymentMethod" title="Verified payment method" text="A valid payment method must be on file." checked={rules.requirePaymentMethod ?? true}/>
      <Rule name="requireDepositAuthorization" title="Deposit authorization" text="Confirm the required deposit can be authorized." checked={rules.requireDepositAuthorization ?? true}/>
      <label className="approval-number"><span><strong>Base security deposit</strong><small>The default deposit before risk adjustments.</small></span><input name="baseDeposit" type="number" min="0" step="25" defaultValue={rules.baseDeposit ?? 500}/></label>
    </div></section>

    <section className="approval-card"><div className="approval-card-head"><div><span>Recommendation factors</span><h2>Evidence the recommendation may consider</h2></div><em>Explainable</em></div><p>These signals may change the recommendation or suggested conditions, but never introduce hidden eligibility rules.</p><div className="approval-grid">
      <Rule name="considerDrivingRecord" title="Driving record" text="Consider verified MVR results and driving events." checked={rules.considerDrivingRecord ?? true}/>
      <Rule name="considerRentalHistory" title="Rental history" text="Consider completed rentals, damage, and policy compliance." checked={rules.considerRentalHistory ?? true}/>
      <Rule name="considerPaymentReliability" title="Payment reliability" text="Consider verified payment failures or successful history." checked={rules.considerPaymentReliability ?? true}/>
      <Rule name="considerVehicleRisk" title="Requested vehicle risk" text="Apply vehicle-specific age, experience, or deposit rules." checked={rules.considerVehicleRisk ?? true}/>
    </div></section>

    <section className="approval-card"><div className="approval-card-head"><div><span>Decision controls</span><h2>AI recommendation and host review</h2></div><em>Host controlled</em></div><div className="approval-select-grid">
      <label>Incomplete information<select name="incompleteDataAction" defaultValue={rules.incompleteDataAction ?? "manual_review"}><option value="manual_review">Send to manual review</option><option value="request_information">Request missing information</option><option value="decline">Recommend decline</option></select></label>
      <label>Conflicting verification results<select name="conflictingDataAction" defaultValue={rules.conflictingDataAction ?? "manual_review"}><option value="manual_review">Send to manual review</option><option value="request_information">Request clarification</option><option value="decline">Recommend decline</option></select></label>
      <label>Automatic approval confidence<select name="autoApprovalThreshold" defaultValue={rules.autoApprovalThreshold ?? 90}><option value="80">80% or higher</option><option value="85">85% or higher</option><option value="90">90% or higher</option><option value="95">95% or higher</option><option value="100">Never approve automatically</option></select></label>
    </div><div className="approval-switches"><Rule name="aiRecommendations" title="Generate AI rental recommendations" text="Summarize policy results, supporting evidence, missing data, risk indicators, and proposed conditions." checked={rules.aiRecommendations ?? true}/><Rule name="requireHostConfirmation" title="Require host confirmation" text="Place recommendations in Waiting Decisions until an authorized host confirms the result." checked={rules.requireHostConfirmation ?? true}/></div></section>

    <aside className="recommendation-preview"><div><span>Recommendation output</span><h2>What the host will receive</h2></div><div className="preview-result"><b>Approve with conditions</b><small>High confidence</small><p>Identity, license, and payment method passed. Updated insurance confirmation is required before approval.</p><div><span>Review evaluation</span><span>Request information</span><span>Approve with conditions</span></div></div></aside>
    <div className="approval-save-bar"><p>Saving rules updates the policy used by renter evaluations, Daily Briefing, and Waiting Decisions.</p><button>Save evaluation rules</button></div>
  </form>;
}
