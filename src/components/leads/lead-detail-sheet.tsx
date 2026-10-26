"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, MessageSquare, Phone, StickyNote } from "lucide-react";
import type { Lead, LeadStatus } from "@/types";
import { DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, LEAD_STAGES } from "@/types";
import { LEAD_STATUS_TONE } from "@/lib/status-map";
import { useUpdateLeadStatus } from "@/hooks/use-leads";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/format";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateStatus = useUpdateLeadStatus();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Keep rendering the last-selected lead's details while the sheet's close animation plays
  // out, instead of flashing blank content when the parent clears the selection to null. Adjusting
  // state during render (rather than in an effect) avoids an extra commit before the update lands.
  const [displayLead, setDisplayLead] = useState<Lead | null>(lead);
  if (lead && lead !== displayLead) {
    setDisplayLead(lead);
  }

  if (!displayLead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{getInitials(displayLead.patient_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">{displayLead.patient_name}</SheetTitle>
              <SheetDescription>{displayLead.phone}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={LEAD_STATUS_TONE[displayLead.status]} label={LEAD_STAGE_LABELS[displayLead.status]} />
            {displayLead.priority === "high" ? <StatusBadge tone="danger" label="High priority" /> : null}
            <Badge variant="outline">{DENTAL_SERVICE_LABELS[displayLead.service]}</Badge>
            <Badge variant="secondary">{LEAD_SOURCE_LABELS[displayLead.source]}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Lead score" value={String(displayLead.lead_score)} />
            <InfoRow label="Estimated value" value={formatCurrency(displayLead.estimated_value)} />
            <InfoRow label="First contact" value={formatDateTime(displayLead.first_contact_at)} />
            <InfoRow label="Last contact" value={formatDateTime(displayLead.last_contact_at)} />
          </dl>

          {displayLead.next_action ? (
            <div className="rounded-lg bg-info-muted px-3 py-2 text-sm text-info">
              <span className="font-medium">Next action: </span>
              {displayLead.next_action}
            </div>
          ) : null}

          <div>
            <label className="text-xs font-medium text-muted-foreground" id="lead-stage-label">
              Pipeline stage
            </label>
            <Select
              value={displayLead.status}
              onValueChange={(value) => {
                const status = value as LeadStatus;
                if (status === displayLead.status) return;
                updateStatus.mutate(
                  { id: displayLead.id, status },
                  {
                    onSuccess: () => toast.success(`Moved ${displayLead.patient_name} to ${LEAD_STAGE_LABELS[status]}.`),
                    onError: () => toast.error("Couldn't update lead stage. Please try again."),
                  }
                );
              }}
            >
              <SelectTrigger aria-labelledby="lead-stage-label" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info(`Calling ${displayLead.patient_name}…`, { description: "Demo mode — no real call is placed via Twilio." })
              }
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.success(`SMS follow-up queued for ${displayLead.patient_name}.`, { description: "Demo mode — no message is actually sent." })
              }
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Send SMS
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Appointment booking will open here once the Appointments module is connected.")}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Book appointment
            </Button>
            <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <StickyNote className="h-4 w-4" aria-hidden="true" />
                Add note
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a note</DialogTitle>
                  <DialogDescription>
                    Notes are visible to your care team. In demo mode, notes aren&apos;t persisted.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`Add context about ${displayLead.patient_name}…`}
                  rows={4}
                  autoFocus
                />
                <DialogFooter>
                  <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                  <Button
                    disabled={!note.trim()}
                    onClick={() => {
                      toast.success("Note saved.", { description: "Demo mode — this note is not persisted." });
                      setNote("");
                      setNoteOpen(false);
                    }}
                  >
                    Save note
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
