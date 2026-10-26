"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePatients } from "@/hooks/use-patients";
import type { PatientFilters } from "@/lib/services";
import type { PatientStatus, PatientType } from "@/types";
import { PATIENT_STATUS_LABELS } from "@/types";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { PatientsTable } from "@/components/patients/patients-table";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

type Segment = "all" | PatientStatus | "high_value";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [patientType, setPatientType] = useState<PatientType | "all">("all");
  const [segment, setSegment] = useState<Segment>("all");

  const filters = useMemo<PatientFilters>(
    () => ({
      search: search.trim() || undefined,
      patientType: patientType === "all" ? undefined : patientType,
      status: segment === "all" || segment === "high_value" ? undefined : segment,
      highValueOnly: segment === "high_value" ? true : undefined,
    }),
    [search, patientType, segment]
  );

  const { data: patients, isLoading, isError, refetch } = usePatients(filters);
  const { data: allPatients } = usePatients();

  const stats = useMemo(() => {
    const list = allPatients ?? [];
    return [
      { label: "Total", value: formatNumber(list.length) },
      { label: "New", value: formatNumber(list.filter((patient) => patient.patient_type === "new").length) },
      { label: "Existing", value: formatNumber(list.filter((patient) => patient.patient_type === "existing").length) },
      { label: "Needs follow-up", value: formatNumber(list.filter((patient) => patient.status === "needs_follow_up").length) },
      { label: "High-value", value: formatNumber(list.filter((patient) => patient.is_high_value || patient.estimated_value >= 2000).length) },
    ];
  }, [allPatients]);

  return (
    <div className="space-y-6">
      <PageHeader title="Patients" description="Everyone who has called or booked with the clinic." />

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Search className="h-4 w-4" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search patients"
          />
        </InputGroup>

        <Select value={patientType} onValueChange={(value) => setPatientType(value as PatientType | "all")}>
          <SelectTrigger aria-label="Filter by patient type">
            <SelectValue placeholder="All patients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            <SelectItem value="new">New patient</SelectItem>
            <SelectItem value="existing">Existing patient</SelectItem>
          </SelectContent>
        </Select>

        <Select value={segment} onValueChange={(value) => setSegment(value as Segment)}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="high_value">High-value</SelectItem>
            {Object.entries(PATIENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard contentClassName="p-0" className="overflow-hidden">
        {isError ? (
          <ErrorState title="Couldn't load patients" description="Something went wrong while loading the patient list." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CardSkeleton lines={8} />
        ) : (
          <PatientsTable patients={patients ?? []} />
        )}
      </SectionCard>
    </div>
  );
}
