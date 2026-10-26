import { describe, expect, it } from "vitest";
import { buildReportPdf } from "./report-pdf";

describe("buildReportPdf", () => {
  it("returns a PDF document that contains the report text", () => {
    const text = buildReportPdf(["Executive summary", "Your clinic received 4 calls today."]);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Executive summary");
    expect(text).toContain("Your clinic received 4 calls today.");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
