"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAIReceptionistStats } from "@/hooks/use-ai-receptionist";
import { useAIReceptionistSettings, useOrganization, useSaveReceptionistConfiguration } from "@/hooks/use-settings";
import { AFTER_HOURS_LABELS, type AIReceptionistSettings, type ClinicProfileInput } from "@/lib/services";
import { CALL_STATUS_LABELS } from "@/types";
import { CALL_STATUS_TONE } from "@/lib/status-map";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";

interface ReceptionistDraft {
  settings: AIReceptionistSettings;
  clinic: ClinicProfileInput;
}

export default function AIReceptionistPage() {
  const stats = useAIReceptionistStats();
  const settings = useAIReceptionistSettings();
  const organization = useOrganization();
  const save = useSaveReceptionistConfiguration();
  const [draft, setDraft] = useState<ReceptionistDraft | null>(null);

  useEffect(() => {
    if (!settings.data || !organization.data || draft) return;
    setDraft({
      settings: settings.data,
      clinic: {
        name: organization.data.name,
        address_line1: organization.data.address_line1,
        city: organization.data.city,
        province: organization.data.province,
        postal_code: organization.data.postal_code,
        phone: organization.data.phone,
      },
    });
  }, [settings.data, organization.data, draft]);

  const failed = stats.isError || settings.isError || organization.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Receptionist"
        description="Today's calls come from DentalFlow. These rules are what the receptionist is allowed to say. Saving them does not change the ElevenLabs phone agent until that agent is updated."
        actions={
          stats.data ? (
            <StatusBadge tone={stats.data.status === "online" ? "success" : "neutral"} label={stats.data.status === "online" ? "Online" : "Offline"} />
          ) : null
        }
      />

      {failed ? (
        <ErrorState
          title="Couldn't load the receptionist"
          description="Something went wrong while loading today's calls or the clinic rules."
          onRetry={() => {
            void stats.refetch();
            void settings.refetch();
            void organization.refetch();
          }}
        />
      ) : stats.isLoading || !stats.data ? (
        <CardSkeleton lines={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm lg:grid-cols-5">
            <Stat label="Calls today" value={formatNumber(stats.data.callsToday)} />
            <Stat label="Calls handled" value={formatNumber(stats.data.callsHandled)} />
            <Stat label="Appointments booked" value={formatNumber(stats.data.appointmentsBooked)} />
            <Stat label="Average call duration" value={stats.data.averageCallDuration} />
            <Stat label="AI booking conversion" value={formatPercent(stats.data.bookingConversion)} />
          </div>

          <SectionCard title="Today's calls" contentClassName="p-0">
            {stats.data.calls.length === 0 ? (
              <EmptyState title="No calls yet today." description="Inbound and outbound calls show up here after they are saved." className="m-5 border-0" />
            ) : (
              <ul className="divide-y divide-border">
                {stats.data.calls.map((call) => (
                  <li key={call.id}>
                    <Link href={`/calls/${call.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/40">
                      <span>
                        <span className="font-medium text-foreground">{call.phone}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDateTime(call.started_at)}
                          {call.ai_handled ? " · AI" : " · Staff"}
                        </span>
                      </span>
                      <StatusBadge tone={CALL_STATUS_TONE[call.status]} label={CALL_STATUS_LABELS[call.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      {!draft ? (
        <CardSkeleton lines={8} />
      ) : (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.clinic.name.trim() || !draft.clinic.phone.trim()) {
              toast.error("Clinic name and phone are required.");
              return;
            }
            save.mutate(draft, {
              onSuccess: () => toast.success("Receptionist settings saved."),
              onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't save the receptionist settings."),
            });
          }}
        >
          <SectionCard title="Controls" description="Mark the receptionist online or offline inside DentalFlow, and set when it should answer.">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{draft.settings.enabled ? "Enabled" : "Disabled"}</p>
                  <p className="text-xs text-muted-foreground">The clinic phone line still follows the ElevenLabs agent.</p>
                </div>
                <Switch
                  checked={draft.settings.enabled}
                  onCheckedChange={(checked) => setDraft({ ...draft, settings: { ...draft.settings, enabled: checked } })}
                  aria-label={draft.settings.enabled ? "Disable AI" : "Enable AI"}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Business hours</p>
                <ul className="space-y-2">
                  {draft.settings.businessHours.map((day, index) => (
                    <li key={day.day} className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-2">
                      <span className="text-sm text-foreground">{day.day}</span>
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) => updateHours(draft, setDraft, index, { isOpen: checked })}
                        aria-label={`${day.day} open`}
                      />
                      <Input
                        type="time"
                        aria-label={`${day.day} opens`}
                        value={day.open}
                        disabled={!day.isOpen}
                        onChange={(event) => updateHours(draft, setDraft, index, { open: event.target.value })}
                      />
                      <Input
                        type="time"
                        aria-label={`${day.day} closes`}
                        value={day.close}
                        disabled={!day.isOpen}
                        onChange={(event) => updateHours(draft, setDraft, index, { close: event.target.value })}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">After-hours behavior</span>
                  <select
                    aria-label="After-hours behavior"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={draft.settings.afterHoursBehavior}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        settings: { ...draft.settings, afterHoursBehavior: event.target.value as AIReceptionistSettings["afterHoursBehavior"] },
                      })
                    }
                  >
                    {Object.entries(AFTER_HOURS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Transfer number</span>
                  <Input
                    aria-label="Transfer number"
                    value={draft.settings.transferNumber}
                    onChange={(event) => setDraft({ ...draft, settings: { ...draft.settings, transferNumber: event.target.value } })}
                  />
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Clinic" description="The receptionist uses this identity. It must not invent a different address or phone number.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clinic name" value={draft.clinic.name} onChange={(name) => setDraft({ ...draft, clinic: { ...draft.clinic, name } })} />
              <Field label="Phone" value={draft.clinic.phone} onChange={(phone) => setDraft({ ...draft, clinic: { ...draft.clinic, phone } })} />
              <Field label="Address" value={draft.clinic.address_line1} onChange={(address_line1) => setDraft({ ...draft, clinic: { ...draft.clinic, address_line1 } })} />
              <Field label="City" value={draft.clinic.city} onChange={(city) => setDraft({ ...draft, clinic: { ...draft.clinic, city } })} />
              <Field label="Province" value={draft.clinic.province} onChange={(province) => setDraft({ ...draft, clinic: { ...draft.clinic, province } })} />
              <Field label="Postal code" value={draft.clinic.postal_code} onChange={(postal_code) => setDraft({ ...draft, clinic: { ...draft.clinic, postal_code } })} />
            </div>
          </SectionCard>

          <SectionCard title="What the receptionist may say" description="Leave a field blank when the clinic has not provided that information. The receptionist must not fill the gap.">
            <div className="space-y-4">
              <Rule label="Emergency policy" value={draft.settings.emergencyPolicy} onChange={(emergencyPolicy) => patchSettings(draft, setDraft, { emergencyPolicy })} />
              <Rule label="Services" value={draft.settings.servicesSummary} onChange={(servicesSummary) => patchSettings(draft, setDraft, { servicesSummary })} />
              <Rule label="Insurance" value={draft.settings.insuranceNote} onChange={(insuranceNote) => patchSettings(draft, setDraft, { insuranceNote })} />
              <Rule label="Payment options" value={draft.settings.paymentOptions} onChange={(paymentOptions) => patchSettings(draft, setDraft, { paymentOptions })} />
              <Rule label="Financing" value={draft.settings.financingNote} onChange={(financingNote) => patchSettings(draft, setDraft, { financingNote })} />
              <Rule label="Pricing" value={draft.settings.pricingNote} onChange={(pricingNote) => patchSettings(draft, setDraft, { pricingNote })} />
              <Rule label="Cancellation policy" value={draft.settings.cancellationPolicy} onChange={(cancellationPolicy) => patchSettings(draft, setDraft, { cancellationPolicy })} />
              <Rule label="Booking rules" value={draft.settings.bookingRules} onChange={(bookingRules) => patchSettings(draft, setDraft, { bookingRules })} />
              <Rule label="Transfer rules" value={draft.settings.transferRules} onChange={(transferRules) => patchSettings(draft, setDraft, { transferRules })} />
            </div>
          </SectionCard>

          <Button type="submit" disabled={save.isPending}>
            Save settings
          </Button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Rule({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <Textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function patchSettings(
  draft: ReceptionistDraft,
  setDraft: (draft: ReceptionistDraft) => void,
  patch: Partial<AIReceptionistSettings>
) {
  setDraft({ ...draft, settings: { ...draft.settings, ...patch } });
}

function updateHours(
  draft: ReceptionistDraft,
  setDraft: (draft: ReceptionistDraft) => void,
  index: number,
  patch: Partial<AIReceptionistSettings["businessHours"][number]>
) {
  const businessHours = draft.settings.businessHours.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day));
  setDraft({ ...draft, settings: { ...draft.settings, businessHours } });
}
