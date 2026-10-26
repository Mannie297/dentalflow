"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, MessageSquare, Phone } from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/types";
import { APPOINTMENT_STATUS_LABELS, DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/types";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status-map";
import { useUpdateAppointmentStatus } from "@/hooks/use-appointments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/format";

const STATUS_ORDER: AppointmentStatus[] = ["requested", "confirmed", "completed", "cancelled", "no_show"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateStatus = useUpdateAppointmentStatus();

  // Keep rendering the last-selected appointment's details while the sheet's close animation plays
  // out, instead of flashing blank content when the parent clears the selection to null -- mirrors
  // the identical pattern in LeadDetailSheet.
  const [displayAppointment, setDisplayAppointment] = useState<Appointment | null>(appointment);
  if (appointment && appointment !== displayAppointment) {
    setDisplayAppointment(appointment);
  }

  if (!displayAppointment) return null;

  function setStatus(status: AppointmentStatus) {
    if (!displayAppointment || status === displayAppointment.status) return;
    updateStatus.mutate(
      { id: displayAppointment.id, status },
      {
        onSuccess: () => toast.success(`${displayAppointment.patient_name}'s appointment marked ${APPOINTMENT_STATUS_LABELS[status].toLowerCase()}.`),
        onError: () => toast.error("Couldn't update the appointment. Please try again."),
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{getInitials(displayAppointment.patient_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">{displayAppointment.patient_name}</SheetTitle>
              <SheetDescription>{formatDateTime(displayAppointment.starts_at)}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={APPOINTMENT_STATUS_TONE[displayAppointment.status]}
              label={APPOINTMENT_STATUS_LABELS[displayAppointment.status]}
            />
            <Badge variant="outline">{DENTAL_SERVICE_LABELS[displayAppointment.service]}</Badge>
            <Badge variant="secondary">{displayAppointment.patient_type === "new" ? "New Patient" : "Existing"}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Dentist" value={displayAppointment.dentist_name} />
            <InfoRow label="Estimated value" value={formatCurrency(displayAppointment.estimated_value)} />
            <InfoRow label="Starts" value={formatDateTime(displayAppointment.starts_at)} />
            <InfoRow label="Ends" value={formatDateTime(displayAppointment.ends_at)} />
            {displayAppointment.source ? (
              <InfoRow label="Source" value={LEAD_SOURCE_LABELS[displayAppointment.source]} />
            ) : null}
          </dl>

          {displayAppointment.notes ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{displayAppointment.notes}</div>
          ) : null}

          <div>
            <label className="text-xs font-medium text-muted-foreground" id="appt-status-label">
              Status
            </label>
            <Select value={displayAppointment.status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
              <SelectTrigger aria-labelledby="appt-status-label" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {APPOINTMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info(`Calling ${displayAppointment.patient_name}…`, {
                  description: "Demo mode — no real call is placed via Twilio.",
                })
              }
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.success(`Reminder SMS queued for ${displayAppointment.patient_name}.`, {
                  description: "Demo mode — no message is actually sent.",
                })
              }
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Send reminder
            </Button>
            {displayAppointment.status !== "completed" && displayAppointment.status !== "cancelled" ? (
              <Button variant="outline" size="sm" onClick={() => setStatus("completed")}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Mark completed
              </Button>
            ) : null}
            {displayAppointment.status !== "cancelled" ? (
              <Button variant="outline" size="sm" onClick={() => setStatus("cancelled")}>
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
