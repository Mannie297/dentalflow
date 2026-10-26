"use client";

import { useState } from "react";
import type { Lead, LeadStatus } from "@/types";
import { LEAD_STAGE_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { LeadCard } from "@/components/leads/lead-card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LeadKanbanColumn({
  status,
  leads,
  draggingLeadId,
  onDragStartLead,
  onDragEndLead,
  onDropLead,
  onSelectLead,
}: {
  status: LeadStatus;
  leads: Lead[];
  draggingLeadId: string | null;
  onDragStartLead: (e: React.DragEvent<HTMLDivElement>, lead: Lead) => void;
  onDragEndLead: () => void;
  onDropLead: (leadId: string, status: LeadStatus) => void;
  onSelectLead: (lead: Lead) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const totalValue = leads.reduce((sum, l) => sum + l.estimated_value, 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const leadId = e.dataTransfer.getData("text/plain");
        if (leadId) onDropLead(leadId, status);
      }}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{LEAD_STAGE_LABELS[status]}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(totalValue, { compact: true })} potential</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {leads.length}
        </Badge>
      </div>

      <div className="max-h-[65vh] flex-1 space-y-2 overflow-y-auto p-2.5">
        {leads.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No leads in this stage.</p>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onSelect={onSelectLead}
              onDragStart={onDragStartLead}
              onDragEnd={onDragEndLead}
              isDragging={draggingLeadId === lead.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
