"use client";

import { useRouter } from "next/navigation";
import { Bot, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, User } from "lucide-react";
import type { Call } from "@/types";
import { CALL_INTENT_LABELS, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS } from "@/types";
import { CALL_STATUS_TONE } from "@/lib/status-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatShortDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CallsTable({ calls }: { calls: Call[] }) {
  const router = useRouter();

  if (calls.length === 0) {
    return (
      <EmptyState
        icon={Phone}
        title="No calls found for this period."
        description="Try selecting a different date range, tab, or search term."
        className="border-0 py-16"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Caller</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Appointment</TableHead>
            <TableHead>AI / Human</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow
              key={call.id}
              tabIndex={0}
              role="button"
              aria-label={`View call with ${call.patient_name ?? "unknown caller"}`}
              onClick={() => router.push(`/calls/${call.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/calls/${call.id}`);
                }
              }}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <TableCell className="text-muted-foreground">{formatDateTime(call.started_at)}</TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{call.patient_name ?? "Unknown Caller"}</div>
                <div className="text-xs text-muted-foreground">{call.phone_number}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  {call.direction === "inbound" ? (
                    <PhoneIncoming className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <PhoneOutgoing className="h-3 w-3" aria-hidden="true" />
                  )}
                  {call.direction === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {call.duration_seconds > 0 ? formatShortDuration(call.duration_seconds) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {call.intent ? CALL_INTENT_LABELS[call.intent] : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {call.outcome ? CALL_OUTCOME_LABELS[call.outcome] : "—"}
              </TableCell>
              <TableCell>
                {call.appointment_id ? (
                  <StatusBadge tone="success" label="Booked" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("gap-1", call.ai_handled ? "text-info" : "text-foreground")}>
                  {call.ai_handled ? <Bot className="h-3 w-3" aria-hidden="true" /> : <User className="h-3 w-3" aria-hidden="true" />}
                  {call.ai_handled ? "AI" : "Human"}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge tone={CALL_STATUS_TONE[call.status]} label={CALL_STATUS_LABELS[call.status]} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {calls.some((c) => c.status === "missed" && c.recovered_from_missed) ? (
        <p className="flex items-center gap-1.5 border-t border-border px-2 py-3 text-xs text-muted-foreground">
          <PhoneMissed className="h-3.5 w-3.5" aria-hidden="true" />
          Missed calls marked recovered were re-contacted successfully through automated follow-up.
        </p>
      ) : null}
    </div>
  );
}
