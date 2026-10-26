"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAIReceptionistSettings, useOrganization, useOrganizationUsers, useSaveReceptionistConfiguration } from "@/hooks/use-settings";
import { useSession } from "@/hooks/use-session";
import type { ClinicProfileInput } from "@/lib/services";
import { AFTER_HOURS_LABELS } from "@/lib/services";
import { ROLE_LABELS } from "@/types";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PLAN_LABELS = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
} as const;

const ROLE_NOTES: { role: keyof typeof ROLE_LABELS; note: string }[] = [
  { role: "CLINIC_OWNER", note: "Full access, including clinic settings and the people on the account." },
  { role: "ADMIN", note: "Same access as the clinic owner." },
  { role: "OFFICE_MANAGER", note: "Calls, patients, appointments, campaigns, analytics, and reports." },
  { role: "RECEPTIONIST", note: "Calls, patients, and appointments." },
];

export default function SettingsPage() {
  const organization = useOrganization();
  const users = useOrganizationUsers();
  const settings = useAIReceptionistSettings();
  const session = useSession();
  const save = useSaveReceptionistConfiguration();
  const [draft, setDraft] = useState<ClinicProfileInput | null>(null);
  const clinic = draft ?? (organization.data
    ? {
        name: organization.data.name,
        address_line1: organization.data.address_line1,
        city: organization.data.city,
        province: organization.data.province,
        postal_code: organization.data.postal_code,
        phone: organization.data.phone,
      }
    : null);

  function updateClinic(patch: Partial<ClinicProfileInput>) {
    if (!clinic) return;
    setDraft({ ...clinic, ...patch });
  }

  function handleSave() {
    if (!clinic || !settings.data) return;
    if (!clinic.name.trim() || !clinic.phone.trim()) {
      toast.error("Clinic name and phone are required.");
      return;
    }
    save.mutate(
      { settings: settings.data, clinic },
      {
        onSuccess: () => toast.success("Clinic profile saved."),
        onError: () => toast.error("Couldn't save the clinic profile."),
      }
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Settings" description="Clinic profile, people, and which services are connected." />

      {organization.isError ? (
        <ErrorState title="Couldn't load the clinic" description="Something went wrong while loading settings." onRetry={() => organization.refetch()} />
      ) : (
        <SectionCard
          title="Clinic profile"
          description="This is the name, address, and phone the receptionist uses."
          actions={
            <Button size="sm" onClick={handleSave} disabled={!clinic || !settings.data || save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          }
        >
          {clinic ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clinic name" value={clinic.name} onChange={(name) => updateClinic({ name })} />
              <Field label="Phone" value={clinic.phone} onChange={(phone) => updateClinic({ phone })} />
              <Field label="Address" value={clinic.address_line1} onChange={(address_line1) => updateClinic({ address_line1 })} className="sm:col-span-2" />
              <Field label="City" value={clinic.city} onChange={(city) => updateClinic({ city })} />
              <Field label="Province" value={clinic.province} onChange={(province) => updateClinic({ province })} />
              <Field label="Postal code" value={clinic.postal_code} onChange={(postal_code) => updateClinic({ postal_code })} />
              <Info label="Time zone" value={organization.data?.timezone || "—"} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading the clinic…</p>
          )}
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Users" description="People who can sign in to this clinic.">
          {users.isError ? (
            <p className="text-sm text-muted-foreground">Couldn't load the people on this account.</p>
          ) : !users.data ? (
            <p className="text-sm text-muted-foreground">Loading people…</p>
          ) : users.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other profiles are on this clinic yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {users.data.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.title || user.email}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}{user.is_active ? "" : " · Inactive"}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Roles" description="What each role can open in DentalFlow.">
          <ul className="space-y-3">
            {ROLE_NOTES.map((item) => (
              <li key={item.role}>
                <p className="text-sm font-medium text-foreground">{ROLE_LABELS[item.role]}</p>
                <p className="text-xs text-muted-foreground">{item.note}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatusCard title="Phone" body={clinic?.phone ? `Clinic line ${clinic.phone}.` : "No clinic phone is saved yet."} detail={settings.data ? `After hours: ${AFTER_HOURS_LABELS[settings.data.afterHoursBehavior]}. Transfer number ${settings.data.transferNumber || "not set"}.` : "Loading receptionist phone rules…"} />
        <StatusCard
          title="AI Receptionist"
          body={settings.data ? (settings.data.enabled ? "The receptionist is enabled in DentalFlow." : "The receptionist is turned off in DentalFlow.") : "Loading receptionist status…"}
          detail="Saving rules here does not change the ElevenLabs agent. Edit the rules on the AI Receptionist page."
          href="/ai-receptionist"
          hrefLabel="Open AI Receptionist"
        />
        <StatusCard title="Calendar" body="Appointments in DentalFlow are the clinic schedule." detail="Google Calendar is not connected." />
        <StatusCard title="SMS" body="Text messages are not sent from DentalFlow." detail="SMS campaigns stay off until a texting service is connected." />
        <StatusCard title="Email" body="Email is not sent from DentalFlow." detail="Report email opens your mail program with the summary. It is not sent by the clinic automatically." />
        <StatusCard
          title="Knowledge base"
          body="Clinic files are hosted in Supabase."
          detail="n8n indexes those files and answers knowledge-base questions."
          href="/knowledge-base"
          hrefLabel="Open Knowledge Base"
        />
        <StatusCard title="Notifications" body="In-app notifications are not turned on." detail="Nothing is pushed to email or text from this page." />
        <StatusCard title="Billing" body={organization.data ? `Plan on file: ${PLAN_LABELS[organization.data.plan]}.` : "Loading the plan…"} detail="Payments and invoices are not connected." />
        <StatusCard
          title="Security"
          body={session.data ? `Signed in as ${session.data.user.full_name}, ${ROLE_LABELS[session.data.user.role]}.` : "Loading your session…"}
          detail="Sign out from the account menu in the header, or use the link below."
          href="/logout"
          hrefLabel="Sign out"
        />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="mt-1.5" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function StatusCard({ title, body, detail, href, hrefLabel }: { title: string; body: string; detail: string; href?: string; hrefLabel?: string }) {
  return (
    <SectionCard title={title}>
      <p className="text-sm text-foreground">{body}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      {href && hrefLabel ? (
        <Button variant="outline" size="sm" className="mt-3" nativeButton={false} render={<Link href={href} />}>
          {hrefLabel}
        </Button>
      ) : null}
    </SectionCard>
  );
}
