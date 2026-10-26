# Lead qualification

This scores a lead that is already in Supabase. It does not have a public webhook. **CORE — Lead Intake** calls it after the lead row exists. The workflow name in n8n is **AI — Lead Qualification**.

## When it runs

Lead intake passes `{ "lead_id": "uuid", "organization_id": "uuid" }` into **When Called by Another Workflow**. Running it again with the same ids re-scores that lead.

## How the process works

1. **Get Lead** loads that lead from Supabase.
2. **Get Prompt Template** loads the active `lead_score` template for that organization. If the clinic has none, it uses the global template (`organization_id` null). The readable copy of the prompt is `/n8n/prompts/lead_score.md`. The live copy is the `prompt_templates` row.
3. **Build Prompt** fills the template placeholders with the lead's name, phone, email, source, service, and message.
4. **Call AI Model** sends that prompt to OpenAI and asks for a JSON object. The node uses the **OpenAI** credential. The model does not write to Supabase.
5. **Validate Structured JSON** accepts only the expected object: `score` from 0 to 100, `priority` of `low` / `medium` / `high`, a service string, `intent` of `appointment` / `pricing_question` / `general_question` / `emergency` / `other`, urgency, `estimated_value`, `recommended_action`, and `summary`. The same rules live in `src/lib/ai/lead-qualification-schema.ts`.
6. If the JSON is invalid, **Log automation_logs: failure** writes a failed `lead.qualified` log and **Return Result: Failure** stops. The lead row is left as it was.
7. If the JSON is valid, **Apply Business Rules** sets the priority the app shows. Score 80 or above is `high`. Score 50 or above is `medium`. Anything lower is `low`. The model's own priority is stored separately and does not drive the board.
8. **Update Lead with AI Results** writes `ai_score`, `ai_priority`, `ai_summary`, `ai_recommended_action`, `lead_score`, `priority`, and `estimated_value`.
9. **Log automation_events: lead.qualified** records that the lead changed.
10. **Return Result: Success** hands `{ "success": true, "lead_id": "...", "ai": { ... } }` back to lead intake.

## Where to look

The Leads page reads `lead_score` and `priority`. The model's wording is in `ai_summary` and `ai_recommended_action`. A failed score is an `automation_logs` row with `workflow_name` **AI — Lead Qualification** and `status` `failed`, not an `automation_events` row.

## When it fails

- No `lead_score` template, or the OpenAI credential missing, stops the run before the lead is updated.
- Invalid model JSON is logged and the lead stays unscored. Fix the prompt or re-run qualification. Do not paste the model output into Supabase by hand.
- The prompt must keep the instruction that the model does not diagnose or give clinical advice. Recommended action for symptoms is that a dentist contacts the patient.
