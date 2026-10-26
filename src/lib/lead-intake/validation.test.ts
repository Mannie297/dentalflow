import { describe, expect, it } from "vitest";
import { normalizeLeadIntakeInput, validateLeadIntakeInput } from "./validation";

describe("validateLeadIntakeInput", () => {
  const base = {
    organization_id: "11111111-1111-1111-1111-111111111111",
    source: "website",
    first_name: "John",
    phone: "+14165551234",
  };

  it("accepts a valid payload with phone only", () => {
    const result = validateLeadIntakeInput(base);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid payload with email only (no phone)", () => {
    const result = validateLeadIntakeInput({
      ...base,
      phone: undefined,
      email: "john@example.com",
    });
    expect(result.valid).toBe(true);
  });

  it("never rejects a lead just because email is missing if phone is present", () => {
    const result = validateLeadIntakeInput({ ...base, email: undefined });
    expect(result.valid).toBe(true);
  });

  it("never rejects a lead just because phone is missing if email is present", () => {
    const result = validateLeadIntakeInput({
      ...base,
      phone: undefined,
      email: "john@example.com",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects when both phone and email are missing", () => {
    const result = validateLeadIntakeInput({ ...base, phone: undefined, email: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one of phone or email is required.");
  });

  it("rejects missing organization_id", () => {
    const result = validateLeadIntakeInput({ ...base, organization_id: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("organization_id is required.");
  });

  it("rejects missing first_name", () => {
    const result = validateLeadIntakeInput({ ...base, first_name: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("first_name is required.");
  });

  it("rejects an unknown source", () => {
    const result = validateLeadIntakeInput({ ...base, source: "carrier_pigeon" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("source must be one of"))).toBe(true);
  });

  it("rejects an implausible email even when phone is present", () => {
    const result = validateLeadIntakeInput({ ...base, email: "not-an-email" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("email does not look like a valid email address.");
  });
});

describe("normalizeLeadIntakeInput", () => {
  it("trims, lowercases email, title-cases names, and preserves the message verbatim", () => {
    const result = normalizeLeadIntakeInput({
      organization_id: "  11111111-1111-1111-1111-111111111111  ",
      source: "  WEBSITE  ",
      first_name: "  john  ",
      last_name: "SMITH",
      phone: "  (416) 555-1234  ",
      email: "  John.Smith@EXAMPLE.com  ",
      service_requested: "  Dental Implant  ",
      message: "  I NEED to know the cost!!  ",
    });

    expect(result.organization_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.source).toBe("website");
    expect(result.first_name).toBe("John");
    expect(result.last_name).toBe("Smith");
    expect(result.phone).toBe("4165551234");
    expect(result.email).toBe("john.smith@example.com");
    expect(result.service_requested).toBe("Dental Implant");
    // Message is only trimmed, never rewritten (casing/punctuation preserved).
    expect(result.message).toBe("I NEED to know the cost!!");
  });

  it("preserves a leading + on phone numbers while stripping other formatting", () => {
    const result = normalizeLeadIntakeInput({
      organization_id: "org",
      source: "website",
      first_name: "Jane",
      phone: "+1 (416) 555-1234",
    });
    expect(result.phone).toBe("+14165551234");
  });

  it("produces null (not empty string) for omitted optional fields", () => {
    const result = normalizeLeadIntakeInput({
      organization_id: "org",
      source: "website",
      first_name: "Jane",
      phone: "4165551234",
    });
    expect(result.last_name).toBeNull();
    expect(result.email).toBeNull();
    expect(result.service_requested).toBeNull();
    expect(result.message).toBeNull();
  });
});
