"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MessageSquare, Phone, User } from "lucide-react";
import { usePatient } from "@/hooks/use-patients";
import { usePlaceOutboundCall } from "@/hooks/use-calls";
import { useUIStore } from "@/store/ui-store";
import { APPOINTMENT_STATUS_LABELS, CALL_STATUS_LABELS, DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, PATIENT_STATUS_LABELS } from "@/types";
import { APPOINTMENT_STATUS_TONE, CALL_STATUS_TONE, LEAD_STATUS_TONE, PATIENT_STATUS_TONE } from "@/lib/status-map";
import { BookAppointmentDialog } from "@/components/appointments/book-appointment-dialog";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function channelLabel(channel: string): string {
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  return "Phone";
}

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = usePatient(id);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const isDemoMode = useUIStore((state) => state.isDemoMode);
  const placeOutboundCall = usePlaceOutboundCall();

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this patient"
        description="Something went wrong while loading the patient profile."
        onRetry={() => refetch()}
        className="py-24"
      />
    );
  }

  if (isLoading) {
    return <LoadingState label="Loading patient…" className="py-24" />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={User}
        title="Patient not found"
        description="This patient may have been removed or the link is incorrect."
        action={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/patients" />}>
            Back to Patients
          </Button>
        }
        className="py-24"
      />
    );
  }

  const { patient, calls, appointments, leads, conversations, campaigns } = data;
  const phoneDigits = patient.phone.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/patients" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Patients
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{patient.full_name}</h1>
            <StatusBadge tone={PATIENT_STATUS_TONE[patient.status]} label={PATIENT_STATUS_LABELS[patient.status]} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient.phone || "No phone"} · {patient.patient_type === "new" ? "New patient" : "Existing patient"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isDemoMode) {
                toast.info("Switch to Live Mode to call this patient.");
                return;
              }
              if (phoneDigits.length < 7) {
                toast.error("This patient has no phone number to dial.");
                return;
              }
              setCallbackOpen(true);
            }}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
          </Button>
          <BookAppointmentDialog
            triggerVariant="outline"
            defaultPatientName={patient.full_name}
            defaultPatientType={patient.patient_type}
            patientId={patient.id}
            source={patient.lead_source}
          />
          <Dialog open={callbackOpen} onOpenChange={setCallbackOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Call {patient.full_name}?</DialogTitle>
                <DialogDescription>
                  Maple Grove Dental Clinic will dial {patient.phone}. The receptionist will say this is a follow-up to their recent visit.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
                <Button
                  disabled={placeOutboundCall.isPending}
                  onClick={() => {
                    placeOutboundCall.mutate(
                      {
                        patient_name: patient.full_name,
                        phone: patient.phone,
                        reason: "a follow-up to your recent visit",
                      },
                      {
                        onSuccess: (result) => {
                          if (!result.success) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success(`Calling ${patient.full_name}.`, {
                            description: "The phone rings after ElevenLabs accepts the call.",
                          });
                          setCallbackOpen(false);
                        },
                        onError: () => toast.error("Couldn't start the call. Please try again."),
                      }
                    );
                  }}
                >
                  {placeOutboundCall.isPending ? "Calling…" : "Call now"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="AI summary">
            {patient.ai_summary ? (
              <p className="text-sm text-foreground">{patient.ai_summary}</p>
            ) : (
              <EmptyState icon={User} title="No AI summary yet." description="A summary appears here after the receptionist has enough history on this patient." className="border-0 py-8" />
            )}
          </SectionCard>

          <SectionCard title="Call history">
            {calls.length === 0 ? (
              <EmptyState icon={Phone} title="No calls yet." className="border-0 py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {calls.map((call) => (
                  <li key={call.id}>
                    <Link href={`/calls/${call.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-foreground">
                      <span>
                        <span className="font-medium text-foreground">{call.direction === "inbound" ? "Inbound" : "Outbound"}</span>
                        <span className="mt-0.5 block text-muted-foreground">{formatDateTime(call.started_at)}</span>
                      </span>
                      <StatusBadge tone={CALL_STATUS_TONE[call.status]} label={CALL_STATUS_LABELS[call.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Appointments">
            {appointments.length === 0 ? (
              <EmptyState icon={Calendar} title="No appointments yet." className="border-0 py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {appointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span>
                      <span className="font-medium text-foreground">{DENTAL_SERVICE_LABELS[appointment.service]}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {formatDateTime(appointment.starts_at)} · {appointment.dentist_name}
                      </span>
                    </span>
                    <StatusBadge tone={APPOINTMENT_STATUS_TONE[appointment.status]} label={APPOINTMENT_STATUS_LABELS[appointment.status]} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Conversation history">
            {conversations.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No conversations yet." className="border-0 py-8" />
            ) : (
              <ul className="space-y-4">
                {conversations.map((conversation) => (
                  <li key={conversation.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{channelLabel(conversation.channel)}</span>
                      <span className="text-muted-foreground">{formatDateTime(conversation.last_message_at)}</span>
                    </div>
                    {conversation.last_message_preview ? <p className="mt-1 text-sm text-muted-foreground">{conversation.last_message_preview}</p> : null}
                    {conversation.messages.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-border pt-3">
                        {conversation.messages.map((message) => (
                          <li key={message.id} className="text-sm">
                            <span className="text-xs text-muted-foreground">
                              {message.direction === "inbound" ? patient.full_name : "Clinic"} · {formatDateTime(message.sent_at)}
                            </span>
                            <p className="text-foreground">{message.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <SectionCard title="Contact">
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <InfoRow label="Phone" value={patient.phone || "—"} />
              <InfoRow label="Email" value={patient.email || "—"} />
              <InfoRow label="Lead source" value={LEAD_SOURCE_LABELS[patient.lead_source]} />
              <InfoRow label="Estimated value" value={formatCurrency(patient.estimated_value)} />
              <InfoRow label="Last appointment" value={patient.last_appointment_at ? formatDateTime(patient.last_appointment_at) : "—"} />
              <InfoRow label="Next appointment" value={patient.next_appointment_at ? formatDateTime(patient.next_appointment_at) : "—"} />
            </dl>
          </SectionCard>

          <SectionCard title="Notes">
            {patient.notes ? <p className="text-sm text-foreground">{patient.notes}</p> : <p className="text-sm text-muted-foreground">No notes yet.</p>}
          </SectionCard>

          <SectionCard title="Leads">
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads linked to this patient.</p>
            ) : (
              <ul className="space-y-3">
                {leads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{lead.patient_name}</span>
                    <StatusBadge tone={LEAD_STATUS_TONE[lead.status]} label={LEAD_STAGE_LABELS[lead.status]} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Campaign history">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              <ul className="space-y-3">
                {campaigns.map((campaign) => (
                  <li key={campaign.id} className="text-sm">
                    <Link href={`/campaigns/${campaign.id}`} className="font-medium text-foreground hover:underline">
                      {campaign.name}
                    </Link>
                    <p className="text-muted-foreground">
                      {campaign.status.replace(/_/g, " ")}
                      {campaign.contacted_at ? ` · ${formatDateTime(campaign.contacted_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
