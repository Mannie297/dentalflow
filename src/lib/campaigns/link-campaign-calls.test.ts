import { describe, expect, it } from "vitest";
import { matchCampaignCalls } from "./link-campaign-calls";

describe("matchCampaignCalls", () => {
  it("links the outbound call that started with the scheduled dial", () => {
    const matched = matchCampaignCalls(
      [{ phone: "+14165550102", scheduledAt: "2026-10-25T13:30:00.000Z", patientName: "Mannie" }],
      [
        { id: "earlier", phone_number: "+14165550102", started_at: "2026-10-25T12:14:56+00:00" },
        { id: "placed", phone_number: "+14165550102", started_at: "2026-10-25T13:30:15+00:00" },
      ]
    );
    expect(matched).toEqual(["placed"]);
  });

  it("ignores an outbound call that started well before the dial", () => {
    const matched = matchCampaignCalls(
      [{ phone: "+14165550102", scheduledAt: "2026-10-25T13:30:00.000Z", patientName: "Mannie" }],
      [{ id: "earlier", phone_number: "+14165550102", started_at: "2026-10-25T12:14:56+00:00" }]
    );
    expect(matched).toEqual([]);
  });
});
