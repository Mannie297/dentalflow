import { describe, expect, it } from "vitest";
import { buildClinicInsights } from "./build-insights";

const now = new Date("2026-10-25T16:00:00.000Z");

describe("buildClinicInsights", () => {
  it("returns nothing when the clinic has no recent activity", () => {
    expect(buildClinicInsights({ calls: [], leads: [], appointments: [] }, now)).toEqual([]);
  });

  it("reports missed calls and a Monday gap from the rows it is given", () => {
    const insights = buildClinicInsights(
      {
        calls: [
          call("2026-10-19T14:00:00.000Z", "missed"),
          call("2026-10-19T15:00:00.000Z", "missed"),
          call("2026-10-19T16:00:00.000Z", "completed"),
          call("2026-10-20T14:00:00.000Z", "completed"),
          call("2026-10-21T14:00:00.000Z", "completed"),
          call("2026-10-22T14:00:00.000Z", "completed"),
        ],
        leads: [],
        appointments: [],
      },
      now
    );
    expect(insights[0]?.title).toBe("2 missed calls in the last 30 days");
    expect(insights.some((insight) => insight.title === "Mondays have a higher missed-call rate")).toBe(true);
    expect(insights.some((insight) => insight.recommendation.includes("voice"))).toBe(true);
  });

  it("flags an open implant inquiry and a cleaning booking gap", () => {
    const insights = buildClinicInsights(
      {
        calls: [call("2026-10-20T14:00:00.000Z", "completed")],
        leads: [
          lead("Dental implant consultation", "qualified", 3000),
          lead("emergency_dental", "booked", 150),
          lead("emergency_dental", "booked", 150),
          lead("general_cleaning", "new", 220),
          lead("general_cleaning", "new", 220),
        ],
        appointments: [],
      },
      now
    );
    expect(insights.some((insight) => insight.metric === "Open implant inquiries")).toBe(true);
    expect(insights.some((insight) => insight.title === "Emergency inquiries book more often than cleanings")).toBe(true);
    expect(insights.some((insight) => insight.metricValue === "$3,000")).toBe(true);
  });
});

function call(started_at: string, status: string) {
  return { started_at, status, recovered_from_missed: false };
}

function lead(service: string, status: string, estimated_value: number) {
  return { created_at: "2026-10-20T14:00:00.000Z", service, status, estimated_value };
}
