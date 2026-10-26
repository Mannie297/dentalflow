import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { UpcomingAppointmentView } from "@/types";
import { DENTAL_SERVICE_LABELS } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { APPOINTMENT_STATUS_LABELS } from "@/types";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status-map";

export function UpcomingAppointmentsWidget({ appointments }: { appointments: UpcomingAppointmentView[] }) {
  return (
    <SectionCard
      title="Upcoming Appointments"
      description="Next scheduled visits at your clinic"
      actions={
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/appointments" />}>
          View Calendar
        </Button>
      }
      contentClassName="p-0"
    >
      {appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming appointments scheduled." className="border-0 m-5" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell className="font-medium text-foreground">{appt.time}</TableCell>
                  <TableCell>{appt.patientName}</TableCell>
                  <TableCell className="text-muted-foreground">{DENTAL_SERVICE_LABELS[appt.service as keyof typeof DENTAL_SERVICE_LABELS] ?? appt.service}</TableCell>
                  <TableCell className="text-muted-foreground">{appt.patientType}</TableCell>
                  <TableCell>
                    <StatusBadge tone={APPOINTMENT_STATUS_TONE[appt.status]} label={APPOINTMENT_STATUS_LABELS[appt.status]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
