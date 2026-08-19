export type ApprovalPolicy = {
  minimumAge: number; requireIdentity: boolean; requireLicense: boolean; requireInsurance: boolean;
  minimumInsuranceCoverage: number; requirePaymentMethod: boolean; requireDepositAuthorization: boolean;
  baseDeposit: number; considerDrivingRecord: boolean; considerRentalHistory: boolean;
  considerPaymentReliability: boolean; considerVehicleRisk: boolean; incompleteDataAction: string;
  conflictingDataAction: string; autoApprovalThreshold: number; requireHostConfirmation: boolean;
};

export type ApplicantEvidence = {
  age?: number; identityVerified?: boolean; licenseValid?: boolean; insuranceCoverage?: number;
  paymentMethodVerified?: boolean; depositAuthorized?: boolean; drivingRisk?: "low"|"medium"|"high";
  rentalHistoryRisk?: "low"|"medium"|"high"; paymentRisk?: "low"|"medium"|"high";
  vehicleRisk?: "standard"|"elevated"; conflictingRecords?: boolean;
};

export function evaluateRenter(policy: ApprovalPolicy, evidence: ApplicantEvidence) {
  const passed: string[] = [], failed: string[] = [], missing: string[] = [], risks: string[] = [], conditions: string[] = [];
  const check = (label: string, value: boolean | undefined) => value === undefined ? missing.push(label) : value ? passed.push(label) : failed.push(label);
  if (evidence.age == null) missing.push("Renter age"); else if (evidence.age >= policy.minimumAge) passed.push("Minimum age"); else failed.push("Minimum age");
  if (policy.requireIdentity) check("Identity verification", evidence.identityVerified);
  if (policy.requireLicense) check("Valid driver’s license", evidence.licenseValid);
  if (policy.requireInsurance) {
    if (evidence.insuranceCoverage == null) missing.push("Insurance coverage");
    else if (evidence.insuranceCoverage >= policy.minimumInsuranceCoverage) passed.push("Insurance coverage");
    else { failed.push("Insurance coverage"); conditions.push("Provide qualifying insurance coverage"); }
  }
  if (policy.requirePaymentMethod) check("Verified payment method", evidence.paymentMethodVerified);
  if (policy.requireDepositAuthorization) check("Deposit authorization", evidence.depositAuthorized);
  if (policy.considerDrivingRecord && evidence.drivingRisk && evidence.drivingRisk !== "low") risks.push(`${evidence.drivingRisk} driving-record risk`);
  if (policy.considerRentalHistory && evidence.rentalHistoryRisk && evidence.rentalHistoryRisk !== "low") risks.push(`${evidence.rentalHistoryRisk} rental-history risk`);
  if (policy.considerPaymentReliability && evidence.paymentRisk && evidence.paymentRisk !== "low") risks.push(`${evidence.paymentRisk} payment risk`);
  if (policy.considerVehicleRisk && evidence.vehicleRisk === "elevated") { risks.push("Elevated vehicle risk"); conditions.push("Review vehicle-specific deposit"); }
  let recommendation: "approve"|"approve_with_conditions"|"manual_review"|"decline" = "approve";
  if (evidence.conflictingRecords) recommendation = policy.conflictingDataAction === "decline" ? "decline" : "manual_review";
  else if (failed.length) recommendation = conditions.length ? "approve_with_conditions" : "decline";
  else if (missing.length) recommendation = policy.incompleteDataAction === "decline" ? "decline" : "manual_review";
  else if (risks.length || conditions.length) recommendation = "approve_with_conditions";
  const confidence = Math.max(0, Math.min(100, 100 - missing.length * 15 - risks.length * 8 - (evidence.conflictingRecords ? 30 : 0)));
  if (recommendation === "approve" && (policy.requireHostConfirmation || confidence < policy.autoApprovalThreshold)) recommendation = "manual_review";
  return { recommendation, confidence, passedRules: passed, failedRules: failed, missingInformation: missing, riskIndicators: risks, suggestedConditions: conditions };
}
