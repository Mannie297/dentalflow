"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Plus } from "lucide-react";
import { useCreateAppointment } from "@/hooks/use-appointments";
import { DENTISTS } from "@/lib/mock";
import { DENTAL_SERVICE_LABELS } from "@/types";
import type { DentalServiceType, LeadSource, PatientType } from "@/types";
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

const DURATIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
];

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultTime(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.toTimeString().slice(0, 5);
}

const EMPTY_FORM = {
  patientName: "",
  patientType: "new" as PatientType,
  service: "" as DentalServiceType | "",
  dentistName: DENTISTS[0],
  date: defaultDate(),
  time: defaultTime(),
  duration: "30",
  estimatedValue: "",
  notes: "",
};

export function BookAppointmentDialog({
  trigger,
  triggerVariant = "default",
  defaultPatientName,
  defaultPatientType = "new",
  leadId,
  patientId,
  callId,
  source,
}: {
  /** Custom trigger element (e.g. a toolbar button inside a lead detail sheet). Defaults to a standalone "Book appointment" button. */
  trigger?: React.ReactElement;
  triggerVariant?: "default" | "outline";
  defaultPatientName?: string;
  defaultPatientType?: PatientType;
  leadId?: string;
  patientId?: string;
  callId?: string;
  source?: LeadSource;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    patientName: defaultPatientName ?? "",
    patientType: defaultPatientType,
  });
  const createAppointment = useCreateAppointment();

  function resetAndClose() {
    setForm({
      ...EMPTY_FORM,
      date: defaultDate(),
      time: defaultTime(),
      patientName: defaultPatientName ?? "",
      patientType: defaultPatientType,
    });
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.service) return;

    const startsAt = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Please provide a valid date and time.");
      return;
    }
    const endsAt = new Date(startsAt.getTime() + Number(form.duration) * 60_000);

    createAppointment.mutate(
      {
        patient_name: form.patientName.trim(),
        patient_type: form.patientType,
        service: form.service,
        dentist_name: form.dentistName,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        estimated_value: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        notes: form.notes.trim() || undefined,
        lead_id: leadId ?? undefined,
        patient_id: patientId ?? undefined,
        call_id: callId ?? undefined,
        source,
      },
      {
        onSuccess: () => {
          toast.success(`Appointment booked for ${form.patientName}.`, {
            description: `${DENTAL_SERVICE_LABELS[form.service as DentalServiceType]} with ${form.dentistName}`,
          });
          resetAndClose();
        },
        onError: () => toast.error("Couldn't book the appointment. Please try again."),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant={triggerVariant} />}>
        {trigger ? null : (
          <>
            {triggerVariant === "outline" ? (
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Book appointment
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book an appointment</DialogTitle>
          <DialogDescription>Schedule a new visit. You can confirm or reschedule it later from the Appointments page.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="appt-patient-name">Patient name</Label>
              <Input
                id="appt-patient-name"
                required
                value={form.patientName}
                onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-patient-type">Patient type</Label>
              <Select value={form.patientType} onValueChange={(v) => setForm((f) => ({ ...f, patientType: v as PatientType }))}>
                <SelectTrigger id="appt-patient-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New patient</SelectItem>
                  <SelectItem value="existing">Existing patient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-service">Service</Label>
              <Select value={form.service} onValueChange={(v) => setForm((f) => ({ ...f, service: v as DentalServiceType }))}>
                <SelectTrigger id="appt-service" className="w-full">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DENTAL_SERVICE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-dentist">Dentist</Label>
              <Select value={form.dentistName} onValueChange={(v) => setForm((f) => ({ ...f, dentistName: v ?? f.dentistName }))}>
              <SelectTrigger id="appt-dentist" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DENTISTS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Time</Label>
              <Input
                id="appt-time"
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-duration">Duration</Label>
              <Select value={form.duration} onValueChange={(v) => setForm((f) => ({ ...f, duration: v ?? f.duration }))}>
                <SelectTrigger id="appt-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-value">Estimated value (optional)</Label>
            <Input
              id="appt-value"
              type="number"
              min={0}
              step={50}
              placeholder="0"
              value={form.estimatedValue}
              onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Notes (optional)</Label>
            <Textarea
              id="appt-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={createAppointment.isPending || !form.patientName.trim() || !form.service}>
              {createAppointment.isPending ? "Booking…" : "Book appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
