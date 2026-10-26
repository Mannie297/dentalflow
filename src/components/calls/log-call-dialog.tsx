"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { useRecordCall } from "@/hooks/use-calls";
import { useSession } from "@/hooks/use-session";
import { useUIStore } from "@/store/ui-store";
import { isN8nCallIntakeConfigured } from "@/lib/config";
import { CALL_INTENT_LABELS, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS } from "@/types";
import type { CallDirection, CallIntent, CallOutcome, CallStatus } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  direction: "inbound" as CallDirection,
  callerName: "",
  phone: "",
  status: "completed" as CallStatus,
  intent: "" as CallIntent | "",
  outcome: "" as CallOutcome | "",
  durationMinutes: "2",
  notes: "",
};

export function LogCallDialog() {
  const { data: session } = useSession();
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const recordCall = useRecordCall();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function resetAndClose() {
    setForm(EMPTY);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = Number(form.durationMinutes);
    recordCall.mutate(
      {
        organization_id: session?.organization.id,
        direction: form.direction,
        caller_name: form.callerName,
        phone: form.phone,
        status: form.status,
        intent: form.intent || null,
        outcome: form.outcome || null,
        duration_seconds: Number.isFinite(minutes) ? Math.round(minutes * 60) : 0,
        notes: form.notes || null,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            toast.error("Couldn't log the call", { description: result.error });
            return;
          }
          const via = !isDemoMode && isN8nCallIntakeConfigured() ? " through n8n" : "";
          toast.success(`${form.direction === "inbound" ? "Inbound" : "Outbound"} call logged${via}.`);
          resetAndClose();
        },
        onError: () => toast.error("Couldn't log the call. Please try again."),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger render={<Button size="sm" />}>
        <Phone className="h-4 w-4" aria-hidden="true" />
        Log call
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>
            Record an inbound or outbound call. A missed or failed call is stored as a missed-call event for follow-up.
          </DialogDescription>
        </DialogHeader>

        {isDemoMode ? (
          <p className="rounded-lg bg-info-muted px-3 py-2 text-sm text-info">
            Demo Mode is on. This call stays in the sample dataset until you switch to Live Mode.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="call-direction">Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: (v as CallDirection) ?? f.direction }))}>
                <SelectTrigger id="call-direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: (v as CallStatus) ?? f.status }))}>
                <SelectTrigger id="call-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CALL_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="call-name">Caller name</Label>
            <Input
              id="call-name"
              required
              value={form.callerName}
              onChange={(e) => setForm((f) => ({ ...f, callerName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="call-phone">Phone</Label>
              <Input
                id="call-phone"
                required
                type="tel"
                placeholder="+14165551234"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-duration">Duration (minutes)</Label>
              <Input
                id="call-duration"
                type="number"
                min={0}
                step={1}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="call-intent">Intent</Label>
              <Select value={form.intent || "none"} onValueChange={(v) => setForm((f) => ({ ...f, intent: !v || v === "none" ? "" : (v as CallIntent) }))}>
                <SelectTrigger id="call-intent" className="w-full">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {Object.entries(CALL_INTENT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-outcome">Outcome</Label>
              <Select value={form.outcome || "none"} onValueChange={(v) => setForm((f) => ({ ...f, outcome: !v || v === "none" ? "" : (v as CallOutcome) }))}>
                <SelectTrigger id="call-outcome" className="w-full">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {Object.entries(CALL_OUTCOME_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="call-notes">Notes</Label>
            <Textarea id="call-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={recordCall.isPending || !form.callerName.trim() || !form.phone.trim()}>
              {recordCall.isPending ? "Saving…" : "Log call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
