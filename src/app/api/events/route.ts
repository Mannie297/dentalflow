/**
 * Inbound event callback for n8n -> DentalFlow AI.
 *
 * n8n workflows normally write directly to Supabase using their own
 * service-role credential (configured inside n8n, never in this repo) -- see
 * /docs/N8N_WORKFLOWS.md. This route exists for the OTHER direction: letting
 * an n8n workflow (or any trusted automation) notify the app that something
 * happened, without giving it direct database credentials. It validates the
 * payload, then uses the server-only Supabase service-role client (see
 * `src/lib/supabase/admin.ts`) to record an `automation_events` row.
 *
 * Auth: a shared secret header (`x-dentalflow-webhook-secret`), checked
 * against the server-only `DENTALFLOW_WEBHOOK_SECRET` env var. If that env
 * var isn't set, the route refuses all requests (fails closed, not open).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_EVENT_NAMES } from "@/types/events";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { asJson } from "@/lib/supabase/mappers";

const eventSchema = z.object({
  event_name: z.enum(SUPPORTED_EVENT_NAMES),
  organization_id: z.uuid(),
  payload: z.record(z.string(), z.unknown()).default({}),
  occurred_at: z.iso.datetime().optional(),
  source: z.enum(["n8n", "twilio", "dentalflow"]).optional(),
});

function entityFromEventName(eventName: string, payload: Record<string, unknown>): { type: string; id: string | null } {
  const [entityType] = eventName.split(".");
  const idField = `${entityType}_id`;
  const id = typeof payload[idField] === "string" ? (payload[idField] as string) : typeof payload.id === "string" ? (payload.id as string) : null;
  return { type: entityType, id };
}

export async function POST(request: Request) {
  const expectedSecret = process.env.DENTALFLOW_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ success: false, error: "This deployment has not enabled the /api/events webhook." }, { status: 503 });
  }
  const providedSecret = request.headers.get("x-dentalflow-webhook-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const { event_name, organization_id, payload } = parsed.data;
  const entity = entityFromEventName(event_name, payload);

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("automation_events")
      .insert({
        organization_id,
        event_type: event_name,
        entity_type: entity.type,
        entity_id: entity.id,
        payload: asJson(payload),
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      await supabase.from("automation_logs").insert({
        organization_id,
        workflow_name: "dentalflow-events-api",
        event_type: event_name,
        status: "failed",
        message: error.message,
        payload: asJson(payload),
      });
      return NextResponse.json({ success: false, error: "Couldn't record the event." }, { status: 500 });
    }

    return NextResponse.json({ success: true, event_id: data.id });
  } catch {
    // Never leak internal stack traces / connection details to the caller.
    return NextResponse.json({ success: false, error: "Internal error recording the event." }, { status: 500 });
  }
}
