export interface CallPerson {
  patient_name: string;
  phone: string;
  reason: string;
}

export interface CallIntervalInput {
  start: Date;
  everyMinutes: number;
  /** Null means "everyone still not scheduled". Only the last interval may use null. */
  callCount: number | null;
}

export interface ScheduledDial extends CallPerson {
  scheduled_at: string;
}

const MIN_GAP_MS = 60_000;

export function planScheduledDials(
  people: CallPerson[],
  intervals: CallIntervalInput[],
  mode: "single" | "batch",
  now = new Date()
): { dials: ScheduledDial[] } | { error: string } {
  if (people.length === 0) return { error: mode === "single" ? "Enter the person's name and phone number." : "Add at least one person from the spreadsheet." };
  if (people.length > 200) return { error: "A schedule can include at most 200 calls." };
  if (intervals.length === 0) return { error: "Add at least one calling interval." };

  for (const person of people) {
    if (!person.patient_name.trim()) return { error: "Every call needs a name." };
    if (person.phone.replace(/\D/g, "").length < 7) return { error: `Enter a full phone number for ${person.patient_name.trim()}.` };
    if (person.reason.trim().length < 3) return { error: "Say what the call is about in a few words." };
  }

  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (Number.isNaN(interval.start.getTime())) return { error: "Each interval needs a start time." };
    if (!Number.isInteger(interval.everyMinutes) || interval.everyMinutes < 1 || interval.everyMinutes > 240) {
      return { error: "The gap between calls must be between 1 and 240 minutes." };
    }
    const isLast = index === intervals.length - 1;
    if (interval.callCount == null && !isLast) return { error: "Only the last interval can take the remaining calls." };
    if (interval.callCount != null && (!Number.isInteger(interval.callCount) || interval.callCount < 1 || interval.callCount > 200)) {
      return { error: "Each interval needs a call count between 1 and 200." };
    }
  }

  const slotsNeeded = mode === "single" ? intervals.reduce((sum, interval) => sum + (interval.callCount ?? 0), 0) : people.length;
  if (mode === "single" && slotsNeeded < 1) return { error: "Set how many times to call." };

  const slots: Date[] = [];
  let remaining = mode === "single" ? slotsNeeded : people.length;
  for (const interval of intervals) {
    if (remaining <= 0) break;
    const count = Math.min(interval.callCount ?? remaining, remaining);
    let time = interval.start.getTime();
    for (let placed = 0; placed < count; placed += 1) {
      slots.push(new Date(time));
      time += interval.everyMinutes * MIN_GAP_MS;
    }
    remaining -= count;
  }
  if (remaining > 0) return { error: `${remaining} ${remaining === 1 ? "call is" : "calls are"} not on an interval yet. Raise a call count or add an interval.` };

  const dials: ScheduledDial[] = slots.map((slot, index) => {
    const person = mode === "single" ? people[0] : people[index];
    return {
      patient_name: person.patient_name.trim(),
      phone: person.phone.trim(),
      reason: person.reason.trim(),
      scheduled_at: slot.toISOString(),
    };
  });

  const times = dials.map((dial) => new Date(dial.scheduled_at).getTime()).sort((a, b) => a - b);
  if (times[0] < now.getTime() - 30_000) return { error: "The first call time has already passed." };
  for (let index = 1; index < times.length; index += 1) {
    if (times[index] - times[index - 1] < MIN_GAP_MS) {
      return { error: "These intervals would place two calls less than a minute apart. Move a start time or increase the gap." };
    }
  }

  return { dials };
}

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return Number.isInteger(value) ? value.toFixed(0) : String(value);
  return String(value).trim();
}

export function contactsFromSheet(rows: Record<string, unknown>[], defaultReason: string): { people: CallPerson[] } | { error: string } {
  if (rows.length === 0) return { error: "The spreadsheet is empty." };
  const keys = Object.keys(rows[0] ?? {});
  const normalized = new Map(keys.map((key) => [headerKey(key), key]));
  const nameKey = ["name", "patient", "patientname", "fullname"].map((key) => normalized.get(key)).find(Boolean);
  const firstKey = normalized.get("firstname");
  const lastKey = normalized.get("lastname");
  const phoneKey = ["phone", "phonenumber", "mobile", "cell", "telephone"].map((key) => normalized.get(key)).find(Boolean);
  const reasonKey = ["reason", "notes", "message"].map((key) => normalized.get(key)).find(Boolean);

  if (!phoneKey || (!nameKey && !firstKey)) {
    return { error: "The first row must include Name and Phone columns. A Reason column is optional." };
  }

  const people: CallPerson[] = [];
  const problems: string[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = nameKey ? cellText(row[nameKey]) : [cellText(row[firstKey ?? ""]), cellText(row[lastKey ?? ""])].filter(Boolean).join(" ");
    const phone = cellText(row[phoneKey]);
    const reason = (reasonKey ? cellText(row[reasonKey]) : "") || defaultReason.trim();
    if (!name && !phone) return;
    if (!name) problems.push(`Row ${rowNumber} is missing a name.`);
    else if (phone.replace(/\D/g, "").length < 7) problems.push(`Row ${rowNumber} needs a full phone number.`);
    else if (reason.trim().length < 3) problems.push(`Row ${rowNumber} needs a reason, or enter a reason that applies to the whole file.`);
    else people.push({ patient_name: name, phone, reason: reason.trim() });
  });

  if (problems.length > 0) return { error: problems.slice(0, 4).join(" ") };
  if (people.length === 0) return { error: "No calls were found in the spreadsheet." };
  if (people.length > 200) return { error: "A schedule can include at most 200 calls." };
  return { people };
}
