import { describe, expect, it } from "vitest";
import { selectCallsNeedingRecovery } from "./recover-missed-calls";

describe("selectCallsNeedingRecovery", () => {
  const missed = [
    { id: "new", phone: "+14165550101", patient_name: "Avery" },
    { id: "queued", phone: "+14165550102", patient_name: "Blake" },
    { id: "short", phone: "555", patient_name: "Casey" },
  ];

  it("keeps a missed call that has no recovery dial", () => {
    expect(selectCallsNeedingRecovery(missed, ["queued"]).map((call) => call.id)).toEqual(["new"]);
  });

  it("does not queue the same missed call twice", () => {
    expect(selectCallsNeedingRecovery(missed, ["new", "queued"])).toEqual([]);
  });
});
