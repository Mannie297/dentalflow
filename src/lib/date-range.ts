import type { DateRange, DateRangePreset } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Resolves a preset (or existing custom range) into concrete ISO from/to bounds. */
export function resolveDateRange(preset: DateRangePreset, custom?: { from: string; to: string }, now: Date = new Date()): DateRange {
  if (preset === "custom" && custom) {
    return { preset, from: custom.from, to: custom.to };
  }

  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { preset, from: today.toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = new Date(today.getTime() - DAY_MS);
      return { preset, from: y.toISOString(), to: endOfDay(y).toISOString() };
    }
    case "last_7_days":
      return { preset, from: new Date(today.getTime() - 6 * DAY_MS).toISOString(), to: endOfDay(now).toISOString() };
    case "last_30_days":
      return { preset, from: new Date(today.getTime() - 29 * DAY_MS).toISOString(), to: endOfDay(now).toISOString() };
    case "last_90_days":
      return { preset, from: new Date(today.getTime() - 89 * DAY_MS).toISOString(), to: endOfDay(now).toISOString() };
    default:
      return { preset: "last_30_days", from: new Date(today.getTime() - 29 * DAY_MS).toISOString(), to: endOfDay(now).toISOString() };
  }
}

/** Returns the immediately preceding period of equal length, used for trend ("vs previous period") calculations. */
export function getPreviousPeriod(range: DateRange): { from: string; to: string } {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const lengthMs = to - from;
  return {
    from: new Date(from - lengthMs - 1).toISOString(),
    to: new Date(from - 1).toISOString(),
  };
}

export function isWithinRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
}

export function calculateTrend(current: number, previous: number): { changePercent: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { changePercent: 0, direction: "flat" };
    return { changePercent: 100, direction: "up" };
  }
  const changePercent = ((current - previous) / previous) * 100;
  const direction = changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "flat";
  return { changePercent, direction };
}
