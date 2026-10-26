"use client";

import { Star } from "lucide-react";
import type { Lead } from "@/types";
import { DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LeadCard({
  lead,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  lead: Lead;
  onSelect: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, lead: Lead) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(lead);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open lead ${lead.patient_name}`}
      className={cn(
        "cursor-grab space-y-2.5 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-all select-none active:cursor-grabbing hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{lead.patient_name}</p>
          <p className="text-xs text-muted-foreground">{lead.phone}</p>
        </div>
        {lead.priority === "high" ? <StatusBadge tone="danger" label="High" className="shrink-0" /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[11px]">
          {DENTAL_SERVICE_LABELS[lead.service]}
        </Badge>
        <Badge variant="secondary" className="text-[11px]">
          {LEAD_SOURCE_LABELS[lead.source]}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Star className="h-3 w-3 text-warning" aria-hidden="true" />
          {lead.lead_score}
        </span>
        <span className="font-semibold text-foreground">{formatCurrency(lead.estimated_value, { compact: true })}</span>
      </div>

      <div className="space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
        <p>Last contact {formatRelativeTime(lead.last_contact_at)}</p>
        {lead.next_action ? <p className="truncate text-foreground">Next: {lead.next_action}</p> : null}
      </div>
    </div>
  );
}
