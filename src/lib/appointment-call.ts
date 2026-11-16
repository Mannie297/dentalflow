export interface AppointmentCallCandidate {
  id: string;
  phone: string;
  patientId: string | null;
  appointmentId: string | null;
  startedAt: string;
  createdAt: string;
  direction?: "inbound" | "outbound";
}

export interface AppointmentCallMatchInput {
  id: string;
  callId: string | null;
  patientId: string | null;
  createdAt: string;
}

const OPEN_CALL_GRACE_MS = 2 * 60 * 1000;

/**
 * The voice agent books during the call, and the call row is written when the
 * call ends. Match the call that was still open at booking time.
 */
export function matchAppointmentCall(
  appointment: AppointmentCallMatchInput,
  calls: AppointmentCallCandidate[]
): AppointmentCallCandidate | null {
  if (appointment.callId) {
    return calls.find((call) => call.id === appointment.callId) ?? null;
  }

  const linked = calls.find((call) => call.appointmentId === appointment.id);
  if (linked) return linked;
  if (!appointment.patientId) return null;

  const bookedAt = new Date(appointment.createdAt).getTime();
  const openDuringBooking = calls
    .filter((call) => call.patientId === appointment.patientId)
    .filter((call) => new Date(call.startedAt).getTime() <= bookedAt + OPEN_CALL_GRACE_MS)
    .filter((call) => new Date(call.createdAt).getTime() >= bookedAt - OPEN_CALL_GRACE_MS)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return openDuringBooking[0] ?? null;
}

export interface AppointmentCallLinks {
  phone: string | null;
  bookingCallId: string | null;
  outboundCalls: { id: string; phone: string; startedAt: string }[];
}

/** The booking call, plus outbound calls placed for this patient after the visit existed. */
export function matchAppointmentCalls(
  appointment: AppointmentCallMatchInput,
  calls: AppointmentCallCandidate[]
): AppointmentCallLinks {
  const booking = matchAppointmentCall(appointment, calls);
  const bookedAt = new Date(appointment.createdAt).getTime();
  const outboundCalls = calls
    .filter((call) => call.direction === "outbound")
    .filter((call) => call.patientId === appointment.patientId)
    .filter((call) => call.id !== booking?.id)
    .filter((call) => new Date(call.startedAt).getTime() >= bookedAt - OPEN_CALL_GRACE_MS)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((call) => ({ id: call.id, phone: call.phone, startedAt: call.startedAt }));

  return {
    phone: booking?.phone ?? outboundCalls[0]?.phone ?? null,
    bookingCallId: booking?.id ?? null,
    outboundCalls,
  };
}
