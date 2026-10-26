import { describe, expect, it } from "vitest";
import { derivePriorityFromScore, validateLeadQualificationOutput } from "./lead-qualification-schema";

describe("validateLeadQualificationOutput", () => {
  const validOutput = {
    score: 92,
    priority: "high",
    service: "Dental Implant",
    intent: "appointment",
    urgency: "normal",
    estimated_value: 6500,
    recommended_action: "Call within 15 minutes",
    summary: "Patient is interested in a dental implant and appears ready to discuss booking.",
  };

  it("accepts well-formed AI output", () => {
    const result = validateLeadQualificationOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(validOutput);
  });

  it("never throws on garbage input", () => {
    expect(() => validateLeadQualificationOutput(null)).not.toThrow();
    expect(() => validateLeadQualificationOutput("not json")).not.toThrow();
    expect(() => validateLeadQualificationOutput(undefined)).not.toThrow();
    expect(() => validateLeadQualificationOutput(42)).not.toThrow();
  });

  it("rejects a score outside 0-100", () => {
    const result = validateLeadQualificationOutput({ ...validOutput, score: 150 });
    expect(result.valid).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toContain("score");
  });

  it("rejects an invalid priority enum value", () => {
    const result = validateLeadQualificationOutput({ ...validOutput, priority: "urgent" });
    expect(result.valid).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { summary, ...withoutSummary } = validOutput;
    void summary;
    const result = validateLeadQualificationOutput(withoutSummary);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("summary");
  });

  it("rejects extra/unexpected top-level shape mismatches (e.g. AI returning a string instead of a number)", () => {
    const result = validateLeadQualificationOutput({ ...validOutput, estimated_value: "a lot" });
    expect(result.valid).toBe(false);
  });
});

describe("derivePriorityFromScore (business rule, not the AI)", () => {
  it("returns high for score >= 80", () => {
    expect(derivePriorityFromScore(80)).toBe("high");
    expect(derivePriorityFromScore(100)).toBe("high");
  });

  it("returns medium for score >= 50 and < 80", () => {
    expect(derivePriorityFromScore(50)).toBe("medium");
    expect(derivePriorityFromScore(79)).toBe("medium");
  });

  it("returns low for score < 50", () => {
    expect(derivePriorityFromScore(0)).toBe("low");
    expect(derivePriorityFromScore(49)).toBe("low");
  });
});
