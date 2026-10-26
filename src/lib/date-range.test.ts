import { describe, expect, it } from "vitest";
import { calculateTrend, getPreviousPeriod, isWithinRange, resolveDateRange } from "./date-range";

describe("resolveDateRange", () => {
  const now = new Date("2026-10-02T15:00:00.000Z");

  it("resolves last_7_days to a 7-day window ending today", () => {
    const range = resolveDateRange("last_7_days", undefined, now);
    const from = new Date(range.from);
    const to = new Date(range.to);
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    // endOfDay(now) - startOfDay(6 days ago) spans 7 calendar days (inclusive),
    // and rounds up to 7 because `to` is 23:59:59.999 rather than exactly midnight.
    expect(diffDays).toBe(7);
    // `to` is end-of-day (23:59:59.999) in the local timezone, not midnight.
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });

  it("resolves last_30_days and last_90_days to their respective windows", () => {
    const r30 = resolveDateRange("last_30_days", undefined, now);
    const r90 = resolveDateRange("last_90_days", undefined, now);
    const days30 = Math.round((new Date(r30.to).getTime() - new Date(r30.from).getTime()) / 86_400_000);
    const days90 = Math.round((new Date(r90.to).getTime() - new Date(r90.from).getTime()) / 86_400_000);
    expect(days30).toBe(30);
    expect(days90).toBe(90);
  });

  it("respects an explicit custom range instead of computing one", () => {
    const range = resolveDateRange("custom", { from: "2026-01-01T00:00:00.000Z", to: "2026-01-15T00:00:00.000Z" }, now);
    expect(range.from).toBe("2026-01-01T00:00:00.000Z");
    expect(range.to).toBe("2026-01-15T00:00:00.000Z");
  });
});

describe("getPreviousPeriod", () => {
  it("returns a window of equal length immediately preceding the given range", () => {
    const range = { preset: "custom" as const, from: "2026-01-11T00:00:00.000Z", to: "2026-01-21T00:00:00.000Z" };
    const prev = getPreviousPeriod(range);
    const rangeLengthMs = new Date(range.to).getTime() - new Date(range.from).getTime();
    const prevLengthMs = new Date(prev.to).getTime() - new Date(prev.from).getTime();
    // Equal length (within 1ms boundary adjustment).
    expect(Math.abs(prevLengthMs - rangeLengthMs)).toBeLessThanOrEqual(1);
    // Immediately before: previous period's end is right before the range starts.
    expect(new Date(prev.to).getTime()).toBeLessThan(new Date(range.from).getTime());
  });
});

describe("isWithinRange", () => {
  it("includes both boundary timestamps", () => {
    expect(isWithinRange("2026-01-05T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(true);
    expect(isWithinRange("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(true);
    expect(isWithinRange("2026-01-10T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(true);
  });

  it("excludes timestamps outside the range", () => {
    expect(isWithinRange("2025-12-31T23:59:59.000Z", "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(false);
    expect(isWithinRange("2026-01-10T00:00:01.000Z", "2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(false);
  });
});

describe("calculateTrend", () => {
  it("returns flat/0 when both current and previous are zero", () => {
    expect(calculateTrend(0, 0)).toEqual({ changePercent: 0, direction: "flat" });
  });

  it("returns up/100% when previous is zero but current is not", () => {
    expect(calculateTrend(5, 0)).toEqual({ changePercent: 100, direction: "up" });
  });

  it("computes percent change and direction normally", () => {
    const result = calculateTrend(150, 100);
    expect(result.changePercent).toBeCloseTo(50, 5);
    expect(result.direction).toBe("up");
  });

  it("treats small changes as flat", () => {
    const result = calculateTrend(100.2, 100);
    expect(result.direction).toBe("flat");
  });
});
