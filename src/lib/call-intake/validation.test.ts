import { describe, expect, it } from "vitest";
import { callEventType, normalizeCallIntakeInput, splitCallerName, validateCallIntakeInput } from "./validation";

const inbound = {
  direction: "inbound",
  caller_name: "ada lovelace",
  phone: "+1 (416) 555-0199",
};

describe("validateCallIntakeInput", () => {
  it("accepts an inbound call", () => {
    expect(validateCallIntakeInput(inbound).valid).toBe(true);
  });

  it("accepts an outbound call", () => {
    expect(validateCallIntakeInput({ ...inbound, direction: "outbound" }).valid).toBe(true);
  });

  it("rejects a direction that is neither inbound nor outbound", () => {
    const result = validateCallIntakeInput({ ...inbound, direction: "sideways" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/direction/);
  });

  it("requires a caller name and a phone number", () => {
    const result = validateCallIntakeInput({ direction: "inbound", caller_name: "  ", phone: "12" });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/caller_name/);
    expect(result.errors.join(" ")).toMatch(/phone/);
  });

  it("requires organization_id only for the webhook path", () => {
    expect(validateCallIntakeInput(inbound).valid).toBe(true);
    expect(validateCallIntakeInput(inbound, { requireOrganization: true }).valid).toBe(false);
    expect(validateCallIntakeInput({ ...inbound, organization_id: "org-1" }, { requireOrganization: true }).valid).toBe(true);
  });
});

describe("normalizeCallIntakeInput", () => {
  it("title-cases the caller and keeps a leading plus on the phone", () => {
    const normalized = normalizeCallIntakeInput(inbound);
    expect(normalized.caller_name).toBe("Ada Lovelace");
    expect(normalized.phone).toBe("+14165550199");
    expect(normalized.direction).toBe("inbound");
    expect(normalized.status).toBe("completed");
  });

  it("drops duration and outcome for a missed call", () => {
    const normalized = normalizeCallIntakeInput({
      ...inbound,
      status: "missed",
      duration_seconds: 90,
      outcome: "voicemail",
    });
    expect(normalized.duration_seconds).toBe(0);
    expect(normalized.outcome).toBeNull();
    expect(callEventType(normalized.status)).toBe("call.missed");
  });

  it("treats a completed call as call.completed", () => {
    expect(callEventType("completed")).toBe("call.completed");
    expect(callEventType("transferred")).toBe("call.completed");
    expect(callEventType("failed")).toBe("call.missed");
  });
});

describe("splitCallerName", () => {
  it("splits the first word from the rest", () => {
    expect(splitCallerName("Ada Lovelace")).toEqual({ first_name: "Ada", last_name: "Lovelace" });
    expect(splitCallerName("Ada")).toEqual({ first_name: "Ada", last_name: "" });
  });
});
