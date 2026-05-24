import type { Tool } from "@/agent/llm";

export const SUBMIT_DECISION_TOOL: Tool = {
  name: "submit_decision",
  description:
    "Submit the agent's decision for a payment case. Call this exactly once with all required fields.",
  input_schema: {
    type: "object",
    properties: {
      case_id: {
        type: "string",
        description: "UUID of the case being decided.",
      },
      action: {
        type: "object",
        description:
          "The chosen action. Set 'kind' and ALL fields required by that variant. " +
          "soft_nudge/friendly_check_in/late_fee_warning/formal_notice require: message (string), language (string). " +
          "friendly_check_in also requires: payment_link_url (string or null). " +
          "formal_notice also requires: level (integer 1-3). " +
          "plan_negotiation requires: proposed_installments (integer), installment_amount_eur_cents (integer), message (string), language (string). " +
          "escalate_human requires: urgency ('low'|'medium'|'high'), reason (string). " +
          "auto_payout_vendor requires: vendor_id (UUID string), amount_eur_cents (integer), invoice_reference (string). " +
          "auto_disburse_landlord requires: landlord_id (UUID string), amount_eur_cents (integer), fee_eur_cents (integer).",
        properties: {
          kind: {
            type: "string",
            enum: [
              "soft_nudge",
              "friendly_check_in",
              "plan_negotiation",
              "late_fee_warning",
              "formal_notice",
              "escalate_human",
              "auto_payout_vendor",
              "auto_disburse_landlord",
            ],
            description: "Action discriminator.",
          },
          message: { type: "string", description: "Message to send to tenant (required for most action kinds)." },
          language: { type: "string", description: "ISO language code, e.g. 'de', 'en', 'fr' (required for tenant-facing actions)." },
          payment_link_url: { type: ["string", "null"], description: "Payment URL or null (required for friendly_check_in)." },
          level: { type: "integer", minimum: 1, maximum: 3, description: "Notice level 1-3 (required for formal_notice)." },
          proposed_installments: { type: "integer", description: "Number of installments (required for plan_negotiation)." },
          installment_amount_eur_cents: { type: "integer", description: "Amount per installment in euro cents (required for plan_negotiation)." },
          urgency: { type: "string", enum: ["low", "medium", "high"], description: "Escalation urgency (required for escalate_human)." },
          reason: { type: "string", description: "Escalation reason (required for escalate_human)." },
          vendor_id: { type: "string", description: "Vendor UUID (required for auto_payout_vendor)." },
          amount_eur_cents: { type: "integer", description: "Amount in euro cents." },
          invoice_reference: { type: "string", description: "Invoice reference (required for auto_payout_vendor)." },
          landlord_id: { type: "string", description: "Landlord UUID (required for auto_disburse_landlord)." },
          fee_eur_cents: { type: "integer", description: "Platform fee in euro cents (required for auto_disburse_landlord)." },
        },
        required: ["kind"],
      },
      confidence: {
        type: "number",
        description: "Confidence score between 0 and 1.",
        minimum: 0,
        maximum: 1,
      },
      reasoning_chain: {
        type: "array",
        description: "Ordered list of reasoning steps.",
        items: {
          type: "object",
          properties: {
            step: { type: "number", description: "Step index (1-based)." },
            thought: { type: "string", description: "Reasoning text for this step." },
            evidence: {
              type: "array",
              items: { type: "string" },
              description: "Supporting evidence snippets (optional).",
            },
          },
          required: ["step", "thought"],
        },
      },
      unstructured_sources: {
        type: "array",
        description: "Free-text sources referenced in reasoning.",
        items: {
          type: "object",
          properties: {
            source: { type: "string" },
            excerpt: { type: "string" },
            weight: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["source", "excerpt", "weight"],
        },
      },
      compliance_check: {
        type: "object",
        description: "Compliance evaluation result.",
        properties: {
          overall: { type: "string", enum: ["pass", "fail"] },
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rule_id: {
                  type: "string",
                  enum: [
                    "verzug_grace",
                    "mahnung_spacing",
                    "late_fee_cap",
                    "contact_hours",
                    "language_match",
                    "max_reminders_per_cycle",
                  ],
                },
                rule_description: { type: "string" },
                result: { type: "string", enum: ["pass", "fail", "n/a"] },
                note: { type: "string" },
              },
              required: ["rule_id", "rule_description", "result"],
            },
          },
          blocked_reason: { type: "string" },
          suggested_alternative: { type: "string" },
        },
        required: ["overall", "results"],
      },
      fairness_check: {
        type: "object",
        description: "Fairness evaluation result.",
        properties: {
          forbidden_keywords_present: { type: "boolean" },
          counterfactual_agreed: { type: ["boolean", "null"] },
          overall: { type: "string", enum: ["pass", "fail"] },
          blocked_reason: { type: "string" },
        },
        required: ["forbidden_keywords_present", "counterfactual_agreed", "overall"],
      },
      audit: {
        type: "object",
        description: "Audit metadata for this decision.",
        properties: {
          timestamp: { type: "string", description: "ISO 8601 timestamp." },
          model: { type: "string", description: "Model ID used." },
          prompt_version: { type: "string", description: "Prompt version string." },
          policy_version: { type: "string", description: "Policy version string." },
        },
        required: ["timestamp", "model", "prompt_version", "policy_version"],
      },
    },
    required: [
      "case_id",
      "action",
      "confidence",
      "reasoning_chain",
      "compliance_check",
      "fairness_check",
      "audit",
    ],
  },
};
