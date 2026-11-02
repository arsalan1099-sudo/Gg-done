export const SAUDI_LEAD_STATUSES = [
  "NEW", "CONTACTED", "DOCUMENTS_PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"
] as const;
export type SaudiLeadStatus = typeof SAUDI_LEAD_STATUSES[number];
export type SaudiChecklist = { phoneConfirmed: boolean; businessDocumentsChecked: boolean; complianceReviewed: boolean };
const transitions: Record<SaudiLeadStatus, readonly SaudiLeadStatus[]> = {
  NEW: ["CONTACTED", "REJECTED"],
  CONTACTED: ["DOCUMENTS_PENDING", "UNDER_REVIEW", "REJECTED"],
  DOCUMENTS_PENDING: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["DOCUMENTS_PENDING", "APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["CONTACTED"]
};
export function isSaudiLeadStatus(value: unknown): value is SaudiLeadStatus {
  return typeof value === "string" && SAUDI_LEAD_STATUSES.some(s => s === value);
}
export function reviewTransition(
  from: unknown, to: unknown, note: unknown, checks: unknown
): {ok: true; from: SaudiLeadStatus; to: SaudiLeadStatus; note: string; checks: SaudiChecklist} | {ok: false; error: string} {
  if (!isSaudiLeadStatus(from) || !isSaudiLeadStatus(to)) return {ok:false,error:"Invalid review status"};
  if (!transitions[from].includes(to)) return {ok:false,error:"Status transition is not permitted"};
  if (typeof note !== "string" || note.trim().length > 1000) return {ok:false,error:"Invalid review note"};
  const trimmed = note.trim();
  if ((to === "APPROVED" || to === "REJECTED") && trimmed.length < 10)
    return {ok:false,error:"Approval/rejection requires a review note (at least 10 characters)"};
  const c = checks && typeof checks === "object" && !Array.isArray(checks) ? checks as Record<string,unknown> : {};
  const checklist: SaudiChecklist = {
    phoneConfirmed:c.phoneConfirmed === true,
    businessDocumentsChecked:c.businessDocumentsChecked === true,
    complianceReviewed:c.complianceReviewed === true
  };
  if (to === "APPROVED" && !Object.values(checklist).every(Boolean))
    return {ok:false,error:"Approval requires confirmation of mobile contact, business documents and compliance review"};
  return {ok:true,from,to,note:trimmed,checks:checklist};
}
