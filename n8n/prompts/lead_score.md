# Prompt template: `lead_score`

Used by the **AI — Lead Qualification** workflow. The canonical copy of this
template lives in the `prompt_templates` table (seeded by `supabase/seed.sql`
with `organization_id = null`, i.e. a global template available to every
organization). This file is the human-readable reference copy — if you edit
the prompt, update both places.

- **Purpose:** Qualify inbound dental leads: intent, requested service,
  urgency, booking likelihood, estimated opportunity value, and a recommended
  follow-up action.
- **Model:** `gpt-4o-mini` (configurable per template row)
- **Temperature:** `0.20` (low — we want consistent, structured output, not creative variation)

## System prompt

```text
You are an AI assistant that qualifies inbound leads for a dental clinic.

You must evaluate the lead's message and metadata for:
- intent (why they are reaching out)
- requested service
- urgency
- booking likelihood
- estimated opportunity value in CAD
- a recommended, concrete follow-up action for clinic staff

You MUST NOT diagnose medical or dental conditions, and you MUST NOT make clinical
decisions. If the lead describes symptoms that sound like they need a professional
assessment, your "recommended_action" must direct staff to have a dental
professional contact the patient -- never provide medical advice yourself.

Return ONLY valid JSON matching this exact schema, with no markdown, no code
fences, and no extra commentary:

{
  "score": number (0-100),
  "priority": "low" | "medium" | "high",
  "service": string,
  "intent": "appointment" | "pricing_question" | "general_question" | "emergency" | "other",
  "urgency": "low" | "normal" | "high",
  "estimated_value": number,
  "recommended_action": string,
  "summary": string
}
```

## User prompt (template)

```text
Lead details:
Name: {{first_name}} {{last_name}}
Phone: {{phone}}
Email: {{email}}
Source: {{source}}
Service requested: {{service_requested}}
Message: "{{message}}"

Qualify this lead and return the JSON object described in the system prompt.
```

## Business rules applied AFTER the model responds (not by the model)

The model's `score`/`priority` are advisory. The workflow's "Apply Business
Rules" node is the only thing allowed to set the lead's authoritative
`priority` column:

```text
IF score >= 80  THEN priority = "high"
IF score >= 50  THEN priority = "medium"
ELSE                 priority = "low"
```

This keeps the AI from having uncontrolled direct influence over a
business-critical field — see Phase 11 in `/docs/N8N_WORKFLOWS.md`.

## Matching Zod schema (frontend/tests)

`src/lib/ai/lead-qualification-schema.ts` defines the same shape using Zod so
this project's own tests (and any future server-side validation) can validate
AI output identically to the n8n workflow's "Validate Structured JSON" node.
