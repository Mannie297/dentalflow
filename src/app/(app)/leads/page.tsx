"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useLeads, useUpdateLeadStatus } from "@/hooks/use-leads";
import { useResolvedDateRange } from "@/store/date-range-store";
import type { LeadFilters } from "@/lib/services";
import type { DentalServiceType, Lead, LeadSource, LeadStatus } from "@/types";
import { DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS, LEAD_STAGES } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { LeadKanbanColumn } from "@/components/leads/lead-kanban-column";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatCurrency, formatNumber } from "@/lib/format";

export default function LeadsPage() {
  const range = useResolvedDateRange();
  const [search, setSearch] = useState("");
  const [service, setService] = useState<DentalServiceType | "all">("all");
  const [source, setSource] = useState<LeadSource | "all">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  const filters = useMemo<LeadFilters>(
    () => ({
      from: range.from,
      to: range.to,
      search: search.trim() || undefined,
      service: service === "all" ? undefined : service,
      source: source === "all" ? undefined : source,
    }),
    [range, search, service, source]
  );

  const { data: leads, isLoading, isError, refetch } = useLeads(filters);
  const updateStatus = useUpdateLeadStatus();

  // Derive the selected lead from the live query data (rather than storing the object itself) so the
  // detail sheet always reflects the latest status after a mutation, instead of a stale snapshot.
  const selectedLead = useMemo(
    () => (selectedLeadId ? (leads?.find((l) => l.id === selectedLeadId) ?? null) : null),
    [leads, selectedLeadId]
  );

  const columns = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>(LEAD_STAGES.map((s) => [s, [] as Lead[]]));
    for (const lead of leads ?? []) {
      map.get(lead.status)?.push(lead);
    }
    return map;
  }, [leads]);

  const pipelineValue = useMemo(
    () =>
      (leads ?? [])
        .filter((l) => l.status !== "lost" && l.status !== "completed")
        .reduce((sum, l) => sum + l.estimated_value, 0),
    [leads]
  );

  function handleDrop(leadId: string, status: LeadStatus) {
    const lead = leads?.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    updateStatus.mutate(
      { id: leadId, status },
      {
        onSuccess: () => toast.success(`${lead.patient_name} moved to the "${status.replace(/_/g, " ")}" stage.`),
        onError: () => toast.error("Couldn't update lead stage. Please try again."),
      }
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Leads"
        description="Track every inquiry from first contact to booked appointment. Drag cards between stages to update status."
        actions={<AddLeadDialog />}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-60">
            <InputGroupAddon>
              <Search className="h-4 w-4" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search leads"
            />
          </InputGroup>

          <select
            aria-label="Filter by service"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:w-44"
            value={service}
            onChange={(event) => setService(event.target.value as DentalServiceType | "all")}
          >
            <option value="all">All services</option>
            {Object.entries(DENTAL_SERVICE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by source"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:w-44"
            value={source}
            onChange={(event) => setSource(event.target.value as LeadSource | "all")}
          >
            <option value="all">All sources</option>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{formatNumber(leads?.length ?? 0)}</span> leads ·{" "}
          <span className="font-medium text-foreground">{formatCurrency(pipelineValue, { compact: true })}</span> active pipeline
        </p>
      </div>

      {isError ? (
        <ErrorState
          title="Couldn't load leads"
          description="Something went wrong while loading the pipeline."
          onRetry={() => refetch()}
          className="py-16"
        />
      ) : isLoading || !leads ? (
        <div className="min-w-0 overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} lines={5} className="w-72 shrink-0" />
            ))}
          </div>
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads found for this period."
          description="Try selecting a different date range or clearing filters."
          className="py-16"
        />
      ) : (
        <div className="min-w-0 overflow-x-auto pb-2">
          <div className="flex w-max gap-4">
          {LEAD_STAGES.map((status) => (
            <LeadKanbanColumn
              key={status}
              status={status}
              leads={columns.get(status) ?? []}
              draggingLeadId={draggingLeadId}
              onDragStartLead={(e, lead) => {
                e.dataTransfer.setData("text/plain", lead.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingLeadId(lead.id);
              }}
              onDragEndLead={() => setDraggingLeadId(null)}
              onDropLead={handleDrop}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
            />
          ))}
          </div>
        </div>
      )}

      <LeadDetailSheet
        lead={selectedLead}
        open={Boolean(selectedLeadId)}
        onOpenChange={(open) => !open && setSelectedLeadId(null)}
      />
    </div>
  );
}
