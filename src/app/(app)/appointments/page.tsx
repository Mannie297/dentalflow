"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";
import { useResolvedDateRange } from "@/store/date-range-store";
import type { AppointmentFilters } from "@/lib/services";
import type { Appointment, AppointmentStatus, DentalServiceType, PatientType } from "@/types";
import { APPOINTMENT_STATUS_LABELS, DENTAL_SERVICE_LABELS } from "@/types";
import { DENTISTS } from "@/lib/mock";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { AppointmentsTable } from "@/components/appointments/appointments-table";
import { AppointmentCalendar, getCalendarGridRange } from "@/components/appointments/appointment-calendar";
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet";
import { BookAppointmentDialog } from "@/components/appointments/book-appointment-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";

type View = "list" | "calendar";

export default function AppointmentsPage() {
  const range = useResolvedDateRange();
  const [view, setView] = useState<View>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AppointmentStatus | "all">("all");
  const [service, setService] = useState<DentalServiceType | "all">("all");
  const [dentistName, setDentistName] = useState<string | "all">("all");
  const [patientType, setPatientType] = useState<PatientType | "all">("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // The List view is bound to the global date-range picker; the Calendar view navigates its own
  // month independently, so each view queries the date bounds it actually needs.
  const periodBounds = view === "calendar" ? getCalendarGridRange(calendarMonth) : { from: range.from, to: range.to };

  const filters = useMemo<AppointmentFilters>(
    () => ({
      from: periodBounds.from,
      to: periodBounds.to,
      search: search.trim() || undefined,
      status: status === "all" ? undefined : status,
      service: service === "all" ? undefined : service,
      dentistName: dentistName === "all" ? undefined : dentistName,
      patientType: patientType === "all" ? undefined : patientType,
    }),
    [periodBounds.from, periodBounds.to, search, status, service, dentistName, patientType]
  );

  const { data: appointments, isLoading, isError, refetch } = useAppointments(filters);
  // Unfiltered-by-status view of the same period, purely for the stats strip -- so the counts reflect
  // the whole period regardless of which status tab/filter is currently applied.
  const { data: periodAppointments } = useAppointments({ from: periodBounds.from, to: periodBounds.to });

  const selectedAppointment = useMemo(
    () => (selectedAppointmentId ? (appointments?.find((a) => a.id === selectedAppointmentId) ?? null) : null),
    [appointments, selectedAppointmentId]
  );

  const stats = useMemo(() => {
    const list = periodAppointments ?? [];
    const countOf = (s: AppointmentStatus) => list.filter((a) => a.status === s).length;
    return [
      { label: "Total", value: formatNumber(list.length) },
      { label: "Requested", value: formatNumber(countOf("requested")) },
      { label: "Confirmed", value: formatNumber(countOf("confirmed")) },
      { label: "Completed", value: formatNumber(countOf("completed")) },
      { label: "Cancelled", value: formatNumber(countOf("cancelled")) },
      { label: "No-show", value: formatNumber(countOf("no_show")) },
    ];
  }, [periodAppointments]);

  function handleSelect(appointment: Appointment) {
    setSelectedAppointmentId(appointment.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Book, confirm, and track every visit across your practice."
        actions={<BookAppointmentDialog />}
      />

      <div className="grid grid-cols-3 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-56">
            <InputGroupAddon>
              <Search className="h-4 w-4" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search by patient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search appointments"
            />
          </InputGroup>

          <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus | "all")}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={service} onValueChange={(v) => setService(v as DentalServiceType | "all")}>
            <SelectTrigger aria-label="Filter by service">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {Object.entries(DENTAL_SERVICE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dentistName} onValueChange={(v) => setDentistName(v ?? "all")}>
            <SelectTrigger aria-label="Filter by dentist">
              <SelectValue placeholder="All dentists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dentists</SelectItem>
              {DENTISTS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={patientType} onValueChange={(v) => setPatientType(v as PatientType | "all")}>
            <SelectTrigger aria-label="Filter by patient type">
              <SelectValue placeholder="New & existing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">New &amp; existing</SelectItem>
              <SelectItem value="new">New patient</SelectItem>
              <SelectItem value="existing">Existing patient</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <SectionCard contentClassName="p-0" className="overflow-hidden">
        {isError ? (
          <ErrorState
            title="Couldn't load appointments"
            description="Something went wrong while loading the schedule."
            onRetry={() => refetch()}
            className="border-0 py-16"
          />
        ) : isLoading || !appointments ? (
          <div className="p-5">
            <CardSkeleton lines={6} />
          </div>
        ) : view === "list" ? (
          <AppointmentsTable appointments={appointments} onSelect={handleSelect} />
        ) : (
          <AppointmentCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            appointments={appointments}
            onSelect={handleSelect}
          />
        )}
      </SectionCard>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={Boolean(selectedAppointmentId)}
        onOpenChange={(open) => !open && setSelectedAppointmentId(null)}
      />
    </div>
  );
}
