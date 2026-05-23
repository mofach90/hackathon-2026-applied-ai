export interface CompliancePolicy {
  verzug_grace_days: number;
  mahnung_levels_min_days_between: number;
  mahnung_required_content: string[];
  late_fee_max_bps_of_rent: number;
  allowed_contact_hours: { start: number; end: number };
  language_must_match_lease: boolean;
  formal_notice_requires_prior_mahnung: boolean;
  max_reminders_per_cycle: number;
  policy_version: string;
}

export const COMPLIANCE_POLICY_V1: CompliancePolicy = {
  verzug_grace_days: 7,
  mahnung_levels_min_days_between: 14,
  mahnung_required_content: ["amount_due", "deadline", "consequences"],
  late_fee_max_bps_of_rent: 500, // 5% = 500 bps
  allowed_contact_hours: { start: 8, end: 20 },
  language_must_match_lease: true,
  formal_notice_requires_prior_mahnung: true,
  max_reminders_per_cycle: 3,
  policy_version: "v1",
};
