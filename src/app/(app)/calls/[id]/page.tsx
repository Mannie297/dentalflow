"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Search as SearchIcon,
  StickyNote,
  User,
} from "lucide-react";
import { useCall, useCallTranscript, usePlaceOutboundCall } from "@/hooks/use-calls";
import { BookAppointmentDialog } from "@/components/appointments/book-appointment-dialog";
import { useUIStore } from "@/store/ui-store";
import { CALL_INTENT_LABELS, CALL_OUTCOME_LABELS, CALL_SENTIMENT_LABELS, CALL_STATUS_LABELS } from "@/types";
import { CALL_STATUS_TONE } from "@/lib/status-map";
import { SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatDateTime, formatShortDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-warning/30 px-0.5 text-foreground">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: call, isLoading, isError, refetch } = useCall(id);
  const { data: transcript, isLoading: transcriptLoading } = useCallTranscript(id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [note, setNote] = useState("");
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const placeOutboundCall = usePlaceOutboundCall();

  const filteredLines = useMemo(() => {
    if (!transcript) return [];
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return transcript.lines;
    return transcript.lines.filter((l) => l.text.toLowerCase().includes(q));
  }, [transcript, transcriptQuery]);

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this call"
        description="Something went wrong while loading call details."
        onRetry={() => refetch()}
        className="py-24"
      />
    );
  }

  if (isLoading) {
    return <LoadingState label="Loading call…" className="py-24" />;
  }

  if (!call) {
    return (
      <EmptyState
        icon={Phone}
        title="Call not found"
        description="This call may have been removed or the link is incorrect."
        action={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/calls" />}>
            Back to Calls
          </Button>
        }
        className="py-24"
      />
    );
  }

  const callerName = call.patient_name ?? "Unknown Caller";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/calls"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Calls
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{callerName}</h1>
            <StatusBadge tone={CALL_STATUS_TONE[call.status]} label={CALL_STATUS_LABELS[call.status]} />
            <Badge variant="outline" className="gap-1">
              {call.direction === "inbound" ? (
                <PhoneIncoming className="h-3 w-3" aria-hidden="true" />
              ) : (
                <PhoneOutgoing className="h-3 w-3" aria-hidden="true" />
              )}
              {call.direction === "inbound" ? "Inbound" : "Outbound"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {call.phone_number} · {formatDateTime(call.started_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={callbackOpen} onOpenChange={setCallbackOpen}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isDemoMode) {
                  toast.info("Switch to Live Mode to call this person back.");
                  return;
                }
                if (!call.phone_number || call.phone_number.replace(/\D/g, "").length < 7) {
                  toast.error("This call has no phone number to dial.");
                  return;
                }
                setCallbackOpen(true);
              }}
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call back
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Call {callerName} back?</DialogTitle>
                <DialogDescription>
                  Maple Grove Dental Clinic will dial {call.phone_number}. The receptionist will say this is a follow-up to their recent call.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                <Button
                  disabled={placeOutboundCall.isPending}
                  onClick={() => {
                    placeOutboundCall.mutate(
                      {
                        patient_name: callerName,
                        phone: call.phone_number,
                        reason: "a follow-up to your recent call",
                      },
                      {
                        onSuccess: (result) => {
                          if (!result.success) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success(`Calling ${callerName}.`, {
                            description: "The phone rings after ElevenLabs accepts the call. It appears on Calls once the conversation ends.",
                          });
                          setCallbackOpen(false);
                        },
                        onError: () => toast.error("Couldn't start the callback. Please try again."),
                      }
                    );
                  }}
                >
                  {placeOutboundCall.isPending ? "Calling…" : "Call now"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success(`SMS follow-up queued for ${callerName}.`, { description: "Demo mode — no message is actually sent." })
            }
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Send SMS
          </Button>
          <BookAppointmentDialog
            triggerVariant="outline"
            defaultPatientName={callerName}
            defaultPatientType={call.intent === "existing_patient" ? "existing" : "new"}
            patientId={call.patient_id ?? undefined}
            callId={call.id}
            source={call.direction === "outbound" ? "outbound_call" : "inbound_call"}
          />
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
                placeholder={`Add context about this call with ${callerName}…`}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="AI Call Summary">
            {transcriptLoading && !call.ai_summary ? (
              <CardSkeleton lines={3} />
            ) : transcript?.summary || call.ai_summary ? (
              <div className="space-y-3 text-sm">
                <p className="text-foreground">{transcript?.summary || call.ai_summary}</p>
                {transcript?.recommended_follow_up ? (
                  <div className="rounded-lg bg-info-muted px-3 py-2 text-sm text-info">
                    <span className="font-medium">Recommended follow-up: </span>
                    {transcript.recommended_follow_up}
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState icon={Bot} title="No AI summary available for this call." className="border-0 py-8" />
            )}
          </SectionCard>

          {call.recording_url ? (
            <SectionCard title="Call Recording">
              <audio controls className="w-full" src={call.recording_url}>
                Your browser does not support the audio element.
              </audio>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Call Transcript"
            actions={
              <InputGroup className="w-full sm:w-56">
                <InputGroupAddon>
                  <SearchIcon className="h-4 w-4" aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  placeholder="Search transcript…"
                  value={transcriptQuery}
                  onChange={(e) => setTranscriptQuery(e.target.value)}
                  aria-label="Search transcript"
                />
              </InputGroup>
            }
          >
            {transcriptLoading ? (
              <CardSkeleton lines={6} />
            ) : !transcript || transcript.lines.length === 0 ? (
              <EmptyState
                icon={Phone}
                title="No transcript available for this call."
                description="The conversation text appears here after an answered AI call is saved."
                className="border-0 py-10"
              />
            ) : filteredLines.length === 0 ? (
              <EmptyState icon={SearchIcon} title="No matching lines" description="Try a different search term." className="border-0 py-10" />
            ) : (
              <ol className="space-y-4">
                {filteredLines.map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        line.speaker === "ai"
                          ? "bg-info-muted text-info"
                          : line.speaker === "staff"
                            ? "bg-warning-muted text-warning"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {line.speaker === "ai" ? (
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {line.speaker === "ai" ? "AI Receptionist" : line.speaker === "staff" ? "Staff" : callerName}
                        </span>
                        <span>{formatShortDuration(line.timestamp_seconds)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">{highlightMatch(line.text, transcriptQuery)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <SectionCard title="Call Details">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Duration" value={call.duration_seconds > 0 ? formatShortDuration(call.duration_seconds) : "—"} />
              <InfoRow label="Outcome" value={call.outcome ? CALL_OUTCOME_LABELS[call.outcome] : "—"} />
              <InfoRow label="Detected intent" value={call.intent ? CALL_INTENT_LABELS[call.intent] : "—"} />
              <InfoRow label="Sentiment" value={call.sentiment ? CALL_SENTIMENT_LABELS[call.sentiment] : "—"} />
              <InfoRow label="Handled by" value={call.ai_handled ? "AI Receptionist" : "Staff"} />
              <InfoRow label="AI confidence" value={call.ai_confidence != null ? `${Math.round(call.ai_confidence * 100)}%` : "—"} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {call.appointment_id ? (
                <StatusBadge tone="success" label="Appointment booked" />
              ) : (
                <StatusBadge tone="neutral" label="No appointment booked" />
              )}
              {call.recovered_from_missed ? <StatusBadge tone="success" label="Recovered from missed call" /> : null}
              {call.campaign_id ? <StatusBadge tone="info" label="Part of outbound campaign" /> : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
