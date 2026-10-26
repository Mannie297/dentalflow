"use client";

import { CalendarDays } from "lucide-react";
import type { Appointment } from "@/types";
import { APPOINTMENT_STATUS_LABELS, DENTAL_SERVICE_LABELS } from "@/types";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";

export function AppointmentsTable({
  appointments,
  onSelect,
}: {
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No appointments found for this period."
        description="Try selecting a different date range or clearing filters."
        className="border-0 py-16"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date &amp; time</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Dentist</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((appt) => (
            <TableRow
              key={appt.id}
              tabIndex={0}
              role="button"
              aria-label={`View appointment for ${appt.patient_name}`}
              onClick={() => onSelect(appt)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(appt);
                }
              }}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <TableCell className="text-muted-foreground">{formatDateTime(appt.starts_at)}</TableCell>
              <TableCell className="font-medium text-foreground">{appt.patient_name}</TableCell>
              <TableCell className="text-muted-foreground">{DENTAL_SERVICE_LABELS[appt.service]}</TableCell>
              <TableCell className="text-muted-foreground">{appt.dentist_name}</TableCell>
              <TableCell>
                <Badge variant="outline">{appt.patient_type === "new" ? "New Patient" : "Existing"}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatCurrency(appt.estimated_value)}</TableCell>
              <TableCell>
                <StatusBadge tone={APPOINTMENT_STATUS_TONE[appt.status]} label={APPOINTMENT_STATUS_LABELS[appt.status]} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
