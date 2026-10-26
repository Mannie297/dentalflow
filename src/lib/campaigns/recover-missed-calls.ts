/** Missed inbound calls that still need one AI voice callback. */

export const RECOVERY_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const RECOVERY_DELAY_MS = 5 * 60 * 1000;
export const RECOVERY_CAMPAIGN_NAME = "Missed Call Recovery";
export const RECOVERY_REASON =
  "You are calling back someone who tried to reach Maple Grove Dental Clinic and did not get through. Ask how you can help and offer to book an appointment. Do not diagnose, prescribe, or promise a price.";

export interface MissedCallCandidate {
  id: string;
  phone: string;
  patient_name: string;
}

/** One callback per missed call. A short number is skipped, and a call that already has a recovery dial is skipped. */
export function selectCallsNeedingRecovery(missed: MissedCallCandidate[], attemptedCallIds: Iterable<string>): MissedCallCandidate[] {
  const taken = new Set(attemptedCallIds);
  const seen = new Set<string>();
  const selected: MissedCallCandidate[] = [];
  for (const call of missed) {
    if (seen.has(call.id) || taken.has(call.id)) continue;
    const digits = call.phone.replace(/\D/g, "");
    if (digits.length < 10) continue;
    seen.add(call.id);
    selected.push(call);
  }
  return selected;
}
