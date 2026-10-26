"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import type { Patient } from "@/types";
import { LEAD_SOURCE_LABELS, PATIENT_STATUS_LABELS } from "@/types";
import { PATIENT_STATUS_TONE } from "@/lib/status-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

function dateOrDash(value: string | null): string {
  return value ? formatDate(value, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function PatientsTable({ patients }: { patients: Patient[] }) {
  const router = useRouter();

  if (patients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No patients found."
        description="Try a different search or filter. Patients appear here after a call is saved."
        className="border-0 py-16"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Patient type</TableHead>
            <TableHead>Last appointment</TableHead>
            <TableHead>Next appointment</TableHead>
            <TableHead>Lead source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Estimated value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow
              key={patient.id}
              tabIndex={0}
              role="button"
              aria-label={`View patient ${patient.full_name}`}
              onClick={() => router.push(`/patients/${patient.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/patients/${patient.id}`);
                }
              }}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <TableCell className="font-medium text-foreground">{patient.full_name}</TableCell>
              <TableCell className="text-muted-foreground">{patient.phone || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{patient.email || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{patient.patient_type === "new" ? "New" : "Existing"}</TableCell>
              <TableCell className="text-muted-foreground">{dateOrDash(patient.last_appointment_at)}</TableCell>
              <TableCell className="text-muted-foreground">{dateOrDash(patient.next_appointment_at)}</TableCell>
              <TableCell className="text-muted-foreground">{LEAD_SOURCE_LABELS[patient.lead_source]}</TableCell>
              <TableCell>
                <StatusBadge tone={PATIENT_STATUS_TONE[patient.status]} label={PATIENT_STATUS_LABELS[patient.status]} />
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(patient.estimated_value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
