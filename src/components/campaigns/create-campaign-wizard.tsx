"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useAudiencePreview, useCreateCampaign } from "@/hooks/use-campaigns";
import { AUDIENCE_PRESETS, buildCampaignScript, defaultCampaignName, type AudiencePreset } from "@/lib/services";
import type { CampaignChannel, CampaignType } from "@/types";
import { CAMPAIGN_CHANNEL_LABELS, CAMPAIGN_TYPE_LABELS } from "@/types";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Type", "Audience", "Channels", "Schedule", "Script", "Preview", "Launch"] as const;
const TYPES = Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[];
const CHANNELS = Object.keys(CAMPAIGN_CHANNEL_LABELS) as CampaignChannel[];

export function CreateCampaignWizard() {
  const router = useRouter();
  const createCampaign = useCreateCampaign();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<CampaignType>("recall");
  const [audience, setAudience] = useState<AudiencePreset>("inactive_6_months");
  const [channels, setChannels] = useState<CampaignChannel[]>(["ai_voice"]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [whenLocal, setWhenLocal] = useState("");
  const [script, setScript] = useState("");
  const [scriptEdited, setScriptEdited] = useState(false);
  const [name, setName] = useState(defaultCampaignName("recall"));
  const [nameEdited, setNameEdited] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preview = useAudiencePreview(audience);

  useEffect(() => {
    if (!nameEdited) setName(defaultCampaignName(type));
  }, [type, nameEdited]);

  useEffect(() => {
    if (step === 4 && !scriptEdited) setScript(buildCampaignScript(type, channels));
  }, [step, type, channels, scriptEdited]);

  const scheduledAt = when === "later" && whenLocal ? new Date(whenLocal).toISOString() : null;
  const audienceLabel = AUDIENCE_PRESETS.find((item) => item.id === audience)?.label ?? "";
  const contactCount = preview.data?.contacts.length ?? 0;

  function toggleChannel(channel: CampaignChannel) {
    setChannels((current) => {
      const next = current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel];
      setScriptEdited(false);
      return next.length > 0 ? next : current;
    });
  }

  function canContinue(): boolean {
    if (step === 2) return channels.length > 0;
    if (step === 3) return when === "now" || Boolean(whenLocal);
    if (step === 4) return script.trim().length > 0;
    if (step === 5) return name.trim().length > 0;
    return true;
  }

  function save(launch: boolean) {
    createCampaign.mutate(
      {
        name: name.trim(),
        type,
        audienceDescription: audienceLabel,
        channels,
        scheduledAt,
        aiScript: script.trim(),
        contactsCount: contactCount,
        launch,
      },
      {
        onSuccess: (campaign) => {
          setConfirmOpen(false);
          toast.success(launch ? `${campaign.name} saved.` : `${campaign.name} saved as a draft.`);
          router.push(`/campaigns/${campaign.id}`);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Couldn't save the campaign.");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Campaign"
        description="Choose who to reach, how to reach them, and the words the receptionist may use."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/campaigns" />}>
            <ArrowLeft />
            Campaigns
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              index === step ? "bg-primary text-primary-foreground" : index < step ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <SectionCard title={STEPS[step]} description={`Step ${step + 1} of ${STEPS.length}`}>
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => {
                  setType(value);
                  setScriptEdited(false);
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left text-sm font-medium",
                  type === value ? "border-primary bg-primary/5 text-foreground" : "border-border text-foreground hover:bg-muted"
                )}
              >
                {CAMPAIGN_TYPE_LABELS[value]}
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            {AUDIENCE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={audience === preset.id}
                onClick={() => setAudience(preset.id)}
                className={cn(
                  "block w-full rounded-lg border px-4 py-3 text-left text-sm",
                  audience === preset.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                {preset.label}
              </button>
            ))}
            <p className="text-sm text-muted-foreground">
              {preview.isLoading ? "Counting matches…" : `${formatNumber(contactCount)} ${contactCount === 1 ? "person matches" : "people match"} this audience.`}
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={channels.includes(channel)}
                  onClick={() => toggleChannel(channel)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium",
                    channels.includes(channel) ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  )}
                >
                  {CAMPAIGN_CHANNEL_LABELS[channel]}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">SMS and email are saved on the campaign. DentalFlow does not send them yet.</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={when === "now"}
                onClick={() => setWhen("now")}
                className={cn("rounded-lg border px-4 py-2 text-sm font-medium", when === "now" ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}
              >
                Start when launched
              </button>
              <button
                type="button"
                aria-pressed={when === "later"}
                onClick={() => setWhen("later")}
                className={cn("rounded-lg border px-4 py-2 text-sm font-medium", when === "later" ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}
              >
                Schedule for later
              </button>
            </div>
            {when === "later" ? (
              <Input type="datetime-local" aria-label="Campaign start" value={whenLocal} onChange={(event) => setWhenLocal(event.target.value)} className="max-w-xs" />
            ) : (
              <p className="text-sm text-muted-foreground">Launching marks the campaign active. A draft stays off until you launch it.</p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2">
            <Textarea
              aria-label="Campaign script"
              value={script}
              onChange={(event) => {
                setScriptEdited(true);
                setScript(event.target.value);
              }}
              className="min-h-40"
            />
            <p className="text-sm text-muted-foreground">The receptionist must not diagnose, prescribe, or add prices or insurance coverage that are not in this script.</p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Campaign name</span>
              <Input
                value={name}
                onChange={(event) => {
                  setNameEdited(true);
                  setName(event.target.value);
                }}
                aria-label="Campaign name"
              />
            </label>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <PreviewItem label="Type" value={CAMPAIGN_TYPE_LABELS[type]} />
              <PreviewItem label="Audience" value={`${audienceLabel} (${formatNumber(contactCount)})`} />
              <PreviewItem label="Channels" value={channels.map((channel) => CAMPAIGN_CHANNEL_LABELS[channel]).join(", ")} />
              <PreviewItem label="Schedule" value={scheduledAt ? formatDateTime(scheduledAt) : "When launched"} />
            </dl>
            <p className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm text-foreground">{script}</p>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Save <span className="font-medium">{name.trim() || "this campaign"}</span> as a draft, or launch it after confirming. Launching stores the campaign. It does not place calls or send SMS or email.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={createCampaign.isPending || name.trim().length === 0}>
                Save draft
              </Button>
              <Button onClick={() => setConfirmOpen(true)} disabled={createCampaign.isPending || name.trim().length === 0}>
                Launch
              </Button>
            </div>
          </div>
        ) : null}

        {step < 6 ? (
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep((current) => current - 1)} disabled={step === 0}>
              Back
            </Button>
            <Button onClick={() => setStep((current) => current + 1)} disabled={!canContinue()}>
              Continue
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button variant="outline" onClick={() => setStep(5)}>
              Back
            </Button>
          </div>
        )}
      </SectionCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch {name.trim()}?</DialogTitle>
            <DialogDescription>
              Maple Grove Dental Clinic will save this campaign
              {scheduledAt ? ` for ${formatDateTime(scheduledAt)}` : " and mark it active"}. No calls, texts, or emails are sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save(true)} disabled={createCampaign.isPending}>
              Launch campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
