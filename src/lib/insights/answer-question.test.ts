import { describe, expect, it } from "vitest";
import { answerFromInsights } from "./answer-question";

const insights = [
  {
    title: "No missed calls in the last 30 days",
    description: "14 calls, 5 leads, and 2 appointments in the last 30 days.",
    recommendation: "Keep the receptionist answering live calls.",
    metric: "Missed calls",
    metricValue: "0",
  },
  {
    title: "1 implant inquiry has no booked visit",
    description: "These implant inquiries are still open.",
    recommendation: "Call those patients back and offer an implant consult.",
    metric: "Open implant inquiries",
    metricValue: "1",
  },
];

describe("answerFromInsights", () => {
  it("answers from the insight that shares the question words", () => {
    expect(answerFromInsights("how many missed calls", insights)).toContain("14 calls, 5 leads");
    expect(answerFromInsights("implant consult", insights)).toContain("implant consult");
  });

  it("says when the card does not cover the question", () => {
    expect(answerFromInsights("parking lot hours", insights)).toContain("do not cover");
  });
});
