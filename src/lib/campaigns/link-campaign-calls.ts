const MATCH_WINDOW_MS = 45 * 60 * 1000;

export interface PlacedCampaignDial {
  phone: string;
  scheduledAt: string;
  patientName: string | null;
}

export interface UnlinkedCall {
  id: string;
  phone_number: string;
  started_at: string;
}

export function phoneTail(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Pair each completed campaign dial with the closest outbound call that was saved without a campaign. */
export function matchCampaignCalls(dials: PlacedCampaignDial[], calls: UnlinkedCall[], windowMs = MATCH_WINDOW_MS): string[] {
  const used = new Set<string>();
  const matched: string[] = [];
  for (const dial of dials) {
    const tail = phoneTail(dial.phone);
    const scheduled = new Date(dial.scheduledAt).getTime();
    if (tail.length < 7 || Number.isNaN(scheduled)) continue;
    const best = calls
      .filter((call) => !used.has(call.id) && phoneTail(call.phone_number) === tail)
      .map((call) => ({ call, gap: Math.abs(new Date(call.started_at).getTime() - scheduled) }))
      .filter((item) => !Number.isNaN(item.gap) && item.gap <= windowMs)
      .sort((a, b) => a.gap - b.gap)[0];
    if (!best) continue;
    used.add(best.call.id);
    matched.push(best.call.id);
  }
  return matched;
}

export function patientNameForCall(dials: PlacedCampaignDial[], phone: string): string | null {
  const tail = phoneTail(phone);
  return dials.find((dial) => phoneTail(dial.phone) === tail)?.patientName ?? null;
}
