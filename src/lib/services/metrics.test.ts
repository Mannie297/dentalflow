import { describe, expect, it } from "vitest";
import type { Appointment, Call, DateRange, Lead } from "@/types";
import { computeCallActivity, computeKPIs, type MetricsDataset } from "./metrics";

const RANGE: DateRange = {
  preset: "custom",
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-01-10T23:59:59.999Z",
};

let counter = 0;
function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

function mkCall(overrides: Partial<Call> = {}): Call {
  return {
    id: uid("call"),
    organization_id: "org-1",
    created_at: "2026-01-05T10:00:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
    patient_id: null,
    patient_name: "Jane Doe",
    lead_id: null,
    direction: "inbound",
    phone_number: "+14165551234",
    started_at: "2026-01-05T10:00:00.000Z",
    ended_at: "2026-01-05T10:05:00.000Z",
    duration_seconds: 300,
    status: "completed",
    intent: "new_patient_inquiry",
    outcome: "booked",
    ai_summary: null,
    ai_handled: true,
    ai_confidence: 0.9,
    appointment_id: null,
    recording_url: null,
    transcript_id: null,
    sentiment: "positive",
    campaign_id: null,
    recovered_from_missed: false,
    ...overrides,
  };
}

function mkLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: uid("lead"),
    organization_id: "org-1",
    created_at: "2026-01-05T10:00:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
    patient_id: null,
    patient_name: "Jane Doe",
    phone: "+14165551234",
    source: "website",
    service: "implants",
    status: "new",
    lead_score: 0,
    estimated_value: 0,
    priority: "low",
    first_contact_at: "2026-01-05T10:00:00.000Z",
    last_contact_at: "2026-01-05T10:00:00.000Z",
    next_action: null,
    appointment_id: null,
    assigned_to: null,
    campaign_id: null,
    ...overrides,
  };
}

function mkAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: uid("appt"),
    organization_id: "org-1",
    created_at: "2026-01-05T10:00:00.000Z",
    updated_at: "2026-01-05T10:00:00.000Z",
    patient_id: null,
    patient_name: "Jane Doe",
    patient_type: "new",
    service: "implants",
    dentist_name: "Dr. Lee",
    starts_at: "2026-01-06T10:00:00.000Z",
    ends_at: "2026-01-06T11:00:00.000Z",
    status: "confirmed",
    source: "website",
    lead_id: null,
    call_id: null,
    campaign_id: null,
    estimated_value: 6000,
    notes: null,
    ...overrides,
  };
}

describe("computeKPIs: conversion rate", () => {
  it("returns 0 (never NaN/Infinity) when there are no leads in range", () => {
    const data: MetricsDataset = { calls: [], leads: [], appointments: [] };
    const kpis = computeKPIs(RANGE, data);
    expect(kpis.conversionRate.value).toBe(0);
    expect(Number.isFinite(kpis.conversionRate.value)).toBe(true);
  });

  it("computes booked-leads / total-leads * 100 when leads exist", () => {
    const data: MetricsDataset = {
      calls: [],
      leads: [
        mkLead({ status: "booked", created_at: "2026-01-02T00:00:00.000Z" }),
        mkLead({ status: "completed", created_at: "2026-01-03T00:00:00.000Z" }),
        mkLead({ status: "new", created_at: "2026-01-04T00:00:00.000Z" }),
        mkLead({ status: "contacted", created_at: "2026-01-05T00:00:00.000Z" }),
      ],
      appointments: [],
    };
    const kpis = computeKPIs(RANGE, data);
    expect(kpis.conversionRate.value).toBe(50);
  });

  it("only counts leads created within the selected range", () => {
    const data: MetricsDataset = {
      calls: [],
      leads: [
        mkLead({ status: "booked", created_at: "2025-12-01T00:00:00.000Z" }), // outside range
        mkLead({ status: "new", created_at: "2026-01-05T00:00:00.000Z" }), // inside range
      ],
      appointments: [],
    };
    const kpis = computeKPIs(RANGE, data);
    expect(kpis.newLeads.value).toBe(1);
    expect(kpis.conversionRate.value).toBe(0);
  });
});

describe("computeKPIs: appointments booked + revenue opportunity", () => {
  it("counts only confirmed/completed appointments as booked", () => {
    const data: MetricsDataset = {
      calls: [],
      leads: [],
      appointments: [
        mkAppointment({ status: "confirmed", created_at: "2026-01-02T00:00:00.000Z", estimated_value: 1000 }),
        mkAppointment({ status: "completed", created_at: "2026-01-03T00:00:00.000Z", estimated_value: 2000 }),
        mkAppointment({ status: "cancelled", created_at: "2026-01-04T00:00:00.000Z", estimated_value: 9999 }),
        mkAppointment({ status: "requested", created_at: "2026-01-05T00:00:00.000Z", estimated_value: 9999 }),
      ],
    };
    const kpis = computeKPIs(RANGE, data);
    expect(kpis.appointmentsBooked.value).toBe(2);
    expect(kpis.revenueOpportunity.value).toBe(3000);
  });

  it("adds a flat $500 per recovered missed call to revenue opportunity", () => {
    const data: MetricsDataset = {
      calls: [
        mkCall({ status: "missed", recovered_from_missed: true, started_at: "2026-01-02T00:00:00.000Z" }),
        mkCall({ status: "missed", recovered_from_missed: false, started_at: "2026-01-03T00:00:00.000Z" }),
      ],
      leads: [],
      appointments: [],
    };
    const kpis = computeKPIs(RANGE, data);
    expect(kpis.revenueOpportunity.value).toBe(500);
  });
});

describe("computeCallActivity: average call duration", () => {
  it("returns 0 (never NaN) when there are no calls at all", () => {
    const summary = computeCallActivity(RANGE, { calls: [], leads: [], appointments: [] });
    expect(summary.averageDurationSeconds).toBe(0);
    expect(summary.totalAnswered).toBe(0);
    expect(summary.totalMissed).toBe(0);
  });

  it("returns 0 when there are calls but none are completed (e.g. all missed)", () => {
    const summary = computeCallActivity(RANGE, {
      calls: [mkCall({ status: "missed", started_at: "2026-01-02T00:00:00.000Z" })],
      leads: [],
      appointments: [],
    });
    expect(summary.averageDurationSeconds).toBe(0);
    expect(summary.totalMissed).toBe(1);
  });

  it("averages duration across completed calls only", () => {
    const summary = computeCallActivity(RANGE, {
      calls: [
        mkCall({ status: "completed", duration_seconds: 100, started_at: "2026-01-02T00:00:00.000Z" }),
        mkCall({ status: "completed", duration_seconds: 300, started_at: "2026-01-03T00:00:00.000Z" }),
        mkCall({ status: "missed", duration_seconds: 0, started_at: "2026-01-04T00:00:00.000Z" }),
      ],
      leads: [],
      appointments: [],
    });
    expect(summary.averageDurationSeconds).toBe(200);
    expect(summary.totalAnswered).toBe(2);
    expect(summary.totalMissed).toBe(1);
  });

  it("buckets calls into per-day points covering every day in the range even with zero calls", () => {
    const summary = computeCallActivity(RANGE, { calls: [], leads: [], appointments: [] });
    // RANGE spans Jan 1 - Jan 10 inclusive = 10 days.
    expect(summary.points.length).toBe(10);
  });
});
