import { describe, expect, it } from "vitest";
import { matchAppointmentCall, matchAppointmentCalls, type AppointmentCallCandidate } from "./appointment-call";

const appointment = {
  id: "appt-1",
  callId: null,
  patientId: "patient-1",
  createdAt: "2026-11-17T13:40:31.546Z",
};

function call(overrides: Partial<AppointmentCallCandidate>): AppointmentCallCandidate {
  return {
    id: "call-1",
    phone: "+15558675309",
    patientId: "patient-1",
    appointmentId: null,
    startedAt: "2026-11-17T13:39:09.000Z",
    createdAt: "2026-11-17T13:40:57.346Z",
    ...overrides,
  };
}

describe("matchAppointmentCall", () => {
  it("uses the call that was still open when the visit was booked", () => {
    const earlier = call({
      id: "earlier",
      startedAt: "2026-11-17T13:24:23.000Z",
      createdAt: "2026-11-17T13:26:33.583Z",
    });
    const bookingCall = call({ id: "booking" });
    expect(matchAppointmentCall(appointment, [earlier, bookingCall])?.id).toBe("booking");
  });

  it("prefers an explicit call id", () => {
    const linked = call({ id: "linked" });
    const other = call({ id: "other" });
    expect(matchAppointmentCall({ ...appointment, callId: "linked" }, [other, linked])?.id).toBe("linked");
  });

  it("links an outbound call placed after the visit was booked", () => {
    const bookingCall = call({ id: "booking" });
    const outbound = call({
      id: "outbound",
      direction: "outbound",
      startedAt: "2026-11-17T15:00:00.000Z",
      createdAt: "2026-11-17T15:04:00.000Z",
    });
    const olderOutbound = call({
      id: "older",
      direction: "outbound",
      startedAt: "2026-11-16T15:00:00.000Z",
      createdAt: "2026-11-16T15:04:00.000Z",
    });
    const links = matchAppointmentCalls(appointment, [bookingCall, outbound, olderOutbound]);
    expect(links.bookingCallId).toBe("booking");
    expect(links.outboundCalls.map((item) => item.id)).toEqual(["outbound"]);
  });

  it("links an outbound call when the visit was not booked on a call", () => {
    const outbound = call({
      id: "outbound",
      direction: "outbound",
      startedAt: "2026-11-17T15:00:00.000Z",
      createdAt: "2026-11-17T15:04:00.000Z",
    });
    const links = matchAppointmentCalls(appointment, [outbound]);
    expect(links.bookingCallId).toBeNull();
    expect(links.outboundCalls.map((item) => item.id)).toEqual(["outbound"]);
    expect(links.phone).toBe(outbound.phone);
  });

  it("returns null when no call was open", () => {
    const finished = call({
      startedAt: "2026-11-17T13:24:23.000Z",
      createdAt: "2026-11-17T13:26:33.583Z",
    });
    expect(matchAppointmentCall(appointment, [finished])).toBeNull();
  });
});
