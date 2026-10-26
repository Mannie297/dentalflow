"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useCampaign, useCancelScheduledCalls, useDeleteCampaign, useScheduledCalls, useUpdateCampaignStatus } from "@/hooks/use-campaigns";
import { APPOINTMENT_STATUS_LABELS, CALL_STATUS_LABELS, CAMPAIGN_CHANNEL_LABELS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from "@/types";
import { APPOINTMENT_STATUS_TONE, CALL_STATUS_TONE, CAMPAIGN_CONTACT_STATUS_TONE, CAMPAIGN_STATUS_TONE } from "@/lib/status-map";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCampaign(id);
  const updateStatus = useUpdateCampaignStatus();
  const removeCampaign = useDeleteCampaign();
  const scheduled = useScheduledCalls(id);
  const cancelScheduled = useCancelScheduledCalls(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pendingCalls = (scheduled.data ?? []).filter((call) => call.status === "pending");

  if (isLoading) return <LoadingState label="Loading campaign…" className="py-24" />;
  if (isError || !data) {
    return (
      <ErrorState
        title="Couldn't load this campaign"
        description="The campaign may have been removed, or something went wrong while loading it."
        onRetry={() => refetch()}
        className="py-24"
      />
    );
  }

  const { campaign, contacts, calls, appointments } = data;
  const conversion = campaign.contacts_count ? (campaign.appointments_count / campaign.contacts_count) * 100 : 0;

  function changeStatus(status: "active" | "paused" | "completed") {
    updateStatus.mutate(
      { id: campaign.id, status },
      {
        onSuccess: () => toast.success(`${campaign.name} is now ${CAMPAIGN_STATUS_LABELS[status].toLowerCase()}.`),
        onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't update the campaign."),
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={CAMPAIGN_TYPE_LABELS[campaign.type]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={CAMPAIGN_STATUS_TONE[campaign.status]} label={CAMPAIGN_STATUS_LABELS[campaign.status]} />
            <Button variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
              <ArrowLeft />
              Campaigns
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {campaign.status === "paused" || campaign.status === "draft" || campaign.status === "scheduled" ? (
          <Button onClick={() => changeStatus("active")} disabled={updateStatus.isPending}>
            {campaign.status === "paused" ? "Resume" : "Mark active"}
          </Button>
        ) : null}
        {campaign.status === "active" || campaign.status === "scheduled" ? (
          <Button variant="outline" onClick={() => changeStatus("paused")} disabled={updateStatus.isPending}>
            Pause
          </Button>
        ) : null}
        {pendingCalls.length > 0 ? (
          <Button
            variant="outline"
            disabled={cancelScheduled.isPending}
            onClick={() =>
              cancelScheduled.mutate(undefined, {
                onSuccess: () => toast.success("Pending calls were removed from the schedule."),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't cancel the pending calls."),
              })
            }
          >
            Cancel pending calls
          </Button>
        ) : null}
        {campaign.status !== "completed" && campaign.status !== "draft" ? (
          <Button variant="outline" onClick={() => changeStatus("completed")} disabled={updateStatus.isPending}>
            Mark completed
          </Button>
        ) : null}
        {campaign.status === "draft" ? (
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            Delete draft
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-4 lg:grid-cols-7">
        <Metric label="Contacts" value={formatNumber(campaign.contacts_count)} />
        <Metric label="Calls" value={formatNumber(campaign.calls_count)} />
        <Metric label="SMS" value={formatNumber(campaign.sms_count)} />
        <Metric label="Responses" value={formatNumber(campaign.responses_count)} />
        <Metric label="Appointments" value={formatNumber(campaign.appointments_count)} />
        <Metric label="Conversion" value={formatPercent(conversion)} />
        <Metric label="Est. revenue" value={formatCurrency(campaign.estimated_revenue)} />
      </div>

      {(scheduled.data ?? []).length > 0 ? (
        <SectionCard title="Scheduled calls" description="The receptionist dials the next pending number when its time arrives. Pause the campaign to hold the rest.">
          <ul className="space-y-3">
            {(scheduled.data ?? []).map((call) => (
              <li key={call.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {call.patient_name} · {call.phone}
                  </p>
                  <p className="text-muted-foreground">
                    {call.scheduled_at ? formatDateTime(call.scheduled_at) : "No time"} · {call.reason}
                    {call.last_error ? ` · ${call.last_error}` : ""}
                  </p>
                </div>
                <StatusBadge tone={scheduledTone(call.status)} label={scheduledLabel(call.status)} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Plan">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Audience" value={campaign.audience_description || "—"} />
            <Info label="Channels" value={campaign.channels.map((channel) => CAMPAIGN_CHANNEL_LABELS[channel] ?? channel).join(", ") || "—"} />
            <Info label="Scheduled" value={campaign.scheduled_at ? formatDateTime(campaign.scheduled_at) : "—"} />
            <Info label="Started" value={campaign.started_at ? formatDateTime(campaign.started_at) : "—"} />
          </dl>
          <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{campaign.ai_script || "No script saved."}</p>
        </SectionCard>

        <SectionCard title="Audience" description="People who match the audience saved on this campaign.">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching people right now.</p>
          ) : (
            <ul className="space-y-3">
              {contacts.slice(0, 12).map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{contact.patient_name}</p>
                    <p className="text-muted-foreground">{contact.phone || "No phone"}</p>
                  </div>
                  <StatusBadge tone={CAMPAIGN_CONTACT_STATUS_TONE[contact.status]} label={contact.status.replace(/_/g, " ")} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Calls">
          {calls.length === 0 ? (
            <EmptyState title="No calls for this campaign yet." description="Calls appear here after they are placed and saved." className="border-0 py-8" />
          ) : (
            <ul className="space-y-3">
              {calls.map((call) => (
                <li key={call.id}>
                  <Link href={`/calls/${call.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
                    <span className="font-medium text-foreground">
                      {call.patient_name || call.phone_number} · {formatDateTime(call.started_at)}
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
            <p className="text-sm text-muted-foreground">No appointments from this campaign yet.</p>
          ) : (
            <ul className="space-y-3">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {appointment.patient_name} · {formatDateTime(appointment.starts_at)}
                  </span>
                  <StatusBadge tone={APPOINTMENT_STATUS_TONE[appointment.status]} label={APPOINTMENT_STATUS_LABELS[appointment.status]} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {campaign.name}?</DialogTitle>
            <DialogDescription>This removes the draft. It does not contact anyone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeCampaign.isPending}
              onClick={() =>
                removeCampaign.mutate(campaign.id, {
                  onSuccess: () => {
                    toast.success("Draft deleted.");
                    router.push("/campaigns");
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't delete the draft."),
                })
              }
            >
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function scheduledLabel(status: string): string {
  if (status === "pending") return "Scheduled";
  if (status === "calling") return "Calling";
  if (status === "contacted") return "Called";
  if (status === "cancelled") return "Cancelled";
  return "Failed";
}

function scheduledTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "contacted") return "success";
  if (status === "calling") return "warning";
  if (status === "failed") return "danger";
  if (status === "pending") return "info";
  return "neutral";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
