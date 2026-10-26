/**
 * Validated shape of the "AI -- Lead Qualification" model output.
 *
 * The n8n workflow's "Validate Structured JSON" node implements the same
 * checks in plain JS (n8n Code nodes can't import npm packages like Zod at
 * runtime) -- see /n8n/workflows/ai-lead-qualification.json and
 * /docs/N8N_WORKFLOWS.md. This schema is the project's own source of truth
 * for the contract and is used by tests (`__tests__/lead-qualification-schema.test.ts`)
 * to make sure both implementations agree.
 *
 * Never trust raw model output -- always parse it through this schema before
 * writing anything to Supabase or displaying it in the UI.
 */
import { z } from "zod";

export const leadQualificationSchema = z.object({
  score: z.number().min(0).max(100),
  priority: z.enum(["low", "medium", "high"]),
  service: z.string().min(1),
  intent: z.enum(["appointment", "pricing_question", "general_question", "emergency", "other"]),
  urgency: z.enum(["low", "normal", "high"]),
  estimated_value: z.number().min(0),
  recommended_action: z.string().min(1),
  summary: z.string().min(1),
});

export type LeadQualificationSchema = z.infer<typeof leadQualificationSchema>;

export interface LeadQualificationValidation {
  valid: boolean;
  data: LeadQualificationSchema | null;
  error: string | null;
}

/** Safely parses raw (untrusted) AI model output. Never throws. */
export function validateLeadQualificationOutput(raw: unknown): LeadQualificationValidation {
  const result = leadQualificationSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data, error: null };
  }
  return { valid: false, data: null, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}

/**
 * Business rule (NOT the model) that derives the lead's authoritative
 * priority from the AI's raw score. Kept separate from the AI call so the
 * model can never directly set a business-critical field -- see Phase 11 in
 * /docs/N8N_WORKFLOWS.md.
 */
export function derivePriorityFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}
