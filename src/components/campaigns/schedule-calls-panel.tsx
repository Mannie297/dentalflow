"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useScheduleCampaignCalls } from "@/hooks/use-campaigns";
import { contactsFromSheet, planScheduledDials, type CallIntervalInput, type CallPerson } from "@/lib/campaigns/schedule-calls";
import { readCallSheet } from "@/lib/campaigns/read-call-sheet";
import type { CampaignType } from "@/types";
import { CAMPAIGN_TYPE_LABELS } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "single" | "batch";

interface IntervalDraft {
  id: string;
  startLocal: string;
  everyMinutes: string;
  callCount: string;
}

const TYPES = Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[];

export function ScheduleCallsPanel() {
  const router = useRouter();
  const schedule = useScheduleCampaignCalls();
  const [mode, setMode] = useState<Mode>("single");
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("recall");
  const [reason, setReason] = useState("");
  const [personName, setPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [intervals, setIntervals] = useState<IntervalDraft[]>([newInterval()]);
  const [planError, setPlanError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedSheet = useMemo(() => (rows ? contactsFromSheet(rows, reason) : null), [rows, reason]);
  const people: CallPerson[] = mode === "single" ? [{ patient_name: personName, phone, reason }] : parsedSheet && "people" in parsedSheet ? parsedSheet.people : [];
  const planned = planScheduledDials(people, toIntervalInputs(intervals), mode);

  async function onFile(file: File | undefined) {
    setPlanError("");
    if (!file) return;
    if (file.size > 2_000_000) {
      setFileError("Use a spreadsheet smaller than 2 MB.");
      setRows(null);
      return;
    }
    try {
      setRows(await readCallSheet(file));
      setFileName(file.name);
      setFileError("");
    } catch {
      setRows(null);
      setFileError("That file could not be read. Use an Excel file with Name and Phone columns.");
    }
  }

  function review() {
    if (!("dials" in planned)) {
      setPlanError(planned.error);
      return;
    }
    if (mode === "batch" && parsedSheet && "error" in parsedSheet) {
      setPlanError(parsedSheet.error);
      return;
    }
    setPlanError("");
    setConfirmOpen(true);
  }

  function save() {
    if (!("dials" in planned)) return;
    const campaignName = name.trim() || (mode === "single" ? `Call ${personName.trim()}` : `Spreadsheet calls`);
    schedule.mutate(
      { name: campaignName, type, reason: reason.trim(), mode, dials: planned.dials },
      {
        onSuccess: (campaign) => {
          setConfirmOpen(false);
          toast.success(`${campaign.name} is scheduled.`);
          router.push(`/campaigns/${campaign.id}`);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't schedule the calls."),
      }
    );
  }

  const sheetProblem = mode === "batch" && parsedSheet && "error" in parsedSheet ? parsedSheet.error : "";
  const readyCount = "dials" in planned ? planned.dials.length : 0;

  return (
    <SectionCard
      title="Schedule calls"
      description="Place one call, or a batch from an Excel file, at the times you set. The receptionist dials each number when its time arrives."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <ModeButton current={mode} value="single" onClick={setMode} label="Single call" />
          <ModeButton current={mode} value="batch" onClick={setMode} label="Batch from Excel" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Campaign name</span>
            <Input aria-label="Campaign name" value={name} placeholder={mode === "single" ? "Call a patient" : "Morning recall calls"} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">Campaign type</span>
            <select
              aria-label="Campaign type"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as CampaignType)}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {CAMPAIGN_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-foreground">What the call is about</span>
          <Input
            aria-label="Call reason"
            value={reason}
            placeholder="a follow-up to your recent visit"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="block text-xs text-muted-foreground">The greeting says this is Maple Grove Dental Clinic calling about these words. Keep it short.</span>
        </label>

        {mode === "single" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Name</span>
              <Input aria-label="Person name" value={personName} onChange={(event) => setPersonName(event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Phone</span>
              <Input aria-label="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Excel file</span>
              <input
                aria-label="Excel file of calls"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              The first row needs Name and Phone columns. Reason is optional when the reason above applies to every row. {fileName ? `Loaded ${fileName}.` : ""}
            </p>
            {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
            {sheetProblem ? <p className="text-sm text-destructive">{sheetProblem}</p> : null}
            {parsedSheet && "people" in parsedSheet ? (
              <p className="text-sm text-foreground">{parsedSheet.people.length} people ready.</p>
            ) : null}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Intervals</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIntervals((current) => [...current, newInterval()])}
              disabled={intervals.length >= 8}
            >
              Add interval
            </Button>
          </div>
          <ul className="space-y-3">
            {intervals.map((interval, index) => (
              <li key={interval.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">{index === 0 ? "First call" : `Interval ${index + 1} starts`}</span>
                  <Input
                    type="datetime-local"
                    aria-label={`Interval ${index + 1} start`}
                    value={interval.startLocal}
                    onChange={(event) => updateInterval(setIntervals, interval.id, { startLocal: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Minutes between</span>
                  <Input
                    inputMode="numeric"
                    aria-label={`Interval ${index + 1} minutes between calls`}
                    value={interval.everyMinutes}
                    onChange={(event) => updateInterval(setIntervals, interval.id, { everyMinutes: event.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">{mode === "single" ? "Attempts" : "Calls"}</span>
                  <Input
                    inputMode="numeric"
                    aria-label={`Interval ${index + 1} call count`}
                    placeholder={mode === "batch" && index === intervals.length - 1 ? "Rest" : "1"}
                    value={interval.callCount}
                    onChange={(event) => updateInterval(setIntervals, interval.id, { callCount: event.target.value })}
                  />
                </label>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="sm" disabled={intervals.length === 1} onClick={() => setIntervals((current) => current.filter((item) => item.id !== interval.id))}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {mode === "single"
              ? "Add another interval for a later round of attempts. Each attempt is at least one minute apart."
              : "Calls run in order through each interval. Leave Calls blank on the last interval to schedule whoever is left."}
          </p>
        </div>

        {"dials" in planned && planned.dials.length > 0 ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium text-foreground">
              {readyCount} {readyCount === 1 ? "call" : "calls"}, {formatDateTime(planned.dials[0].scheduled_at)}
              {readyCount > 1 ? ` through ${formatDateTime(planned.dials[readyCount - 1].scheduled_at)}` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {planned.dials.slice(0, 6).map((dial) => (
                <li key={`${dial.phone}-${dial.scheduled_at}`}>
                  {formatDateTime(dial.scheduled_at)} · {dial.patient_name}
                </li>
              ))}
              {planned.dials.length > 6 ? <li>and {planned.dials.length - 6} more</li> : null}
            </ul>
          </div>
        ) : null}

        {planError ? <p className="text-sm text-destructive">{planError}</p> : null}

        <Button type="button" onClick={review} disabled={schedule.isPending}>
          Review schedule
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule {readyCount === 1 ? "this call" : `these ${readyCount} calls`}?</DialogTitle>
            <DialogDescription>
              Maple Grove Dental Clinic will dial {readyCount === 1 ? "this number" : "these numbers"} through the receptionist at the times shown. Only include people the clinic may call.
              Calls also go out when this page is closed after the Campaign Call Dispatcher workflow is active in n8n.
            </DialogDescription>
          </DialogHeader>
          {"dials" in planned ? (
            <p className="text-sm text-foreground">
              First call {formatDateTime(planned.dials[0].scheduled_at)}
              {planned.dials.length > 1 ? `. Last call ${formatDateTime(planned.dials[planned.dials.length - 1].scheduled_at)}.` : "."}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={schedule.isPending || !("dials" in planned)}>
              Schedule calls
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function ModeButton({ current, value, label, onClick }: { current: Mode; value: Mode; label: string; onClick: (mode: Mode) => void }) {
  return (
    <button
      type="button"
      aria-pressed={current === value}
      onClick={() => onClick(value)}
      className={cn("rounded-lg border px-4 py-2 text-sm font-medium", current === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}
    >
      {label}
    </button>
  );
}

function newInterval(): IntervalDraft {
  return { id: Math.random().toString(36).slice(2, 9), startLocal: defaultStartLocal(), everyMinutes: "5", callCount: "1" };
}

function defaultStartLocal(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  const remainder = date.getMinutes() % 15;
  date.setMinutes(date.getMinutes() + (remainder === 0 ? 15 : 15 - remainder));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updateInterval(setIntervals: Dispatch<SetStateAction<IntervalDraft[]>>, id: string, patch: Partial<IntervalDraft>) {
  setIntervals((current) => current.map((interval) => (interval.id === id ? { ...interval, ...patch } : interval)));
}

function toIntervalInputs(intervals: IntervalDraft[]): CallIntervalInput[] {
  return intervals.map((interval) => {
    const count = interval.callCount.trim();
    return {
      start: new Date(interval.startLocal),
      everyMinutes: Number(interval.everyMinutes),
      callCount: count === "" ? null : Number(count),
    };
  });
}
