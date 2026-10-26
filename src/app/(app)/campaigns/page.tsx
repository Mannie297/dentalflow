"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { CampaignStatus } from "@/types";
import { CAMPAIGN_STATUS_LABELS } from "@/types";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { ScheduleCallsPanel } from "@/components/campaigns/schedule-calls-panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

type CampaignFilter = "all" | CampaignStatus;

const EMPTY_TITLES: Record<CampaignFilter, string> = {
  all: "No campaigns yet.",
  active: "No campaigns are currently active.",
  completed: "No completed campaigns.",
  scheduled: "No campaigns are scheduled.",
  draft: "No draft campaigns.",
  paused: "No paused campaigns.",
};

export default function CampaignsPage() {
  const [status, setStatus] = useState<CampaignFilter>("all");
  const { data, isLoading, isError, refetch } = useCampaigns();

  const stats = useMemo(() => {
    const list = data ?? [];
    return [
      { label: "Active", value: formatNumber(list.filter((campaign) => campaign.status === "active").length) },
      { label: "Scheduled", value: formatNumber(list.filter((campaign) => campaign.status === "scheduled").length) },
      { label: "Completed", value: formatNumber(list.filter((campaign) => campaign.status === "completed").length) },
      { label: "Drafts", value: formatNumber(list.filter((campaign) => campaign.status === "draft").length) },
    ];
  }, [data]);

  const visible = (data ?? []).filter((campaign) => status === "all" || campaign.status === status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Schedule one call or a batch from Excel. The receptionist dials each number at the interval you set."
        actions={
          <Button nativeButton={false} render={<Link href="/campaigns/new" />}>
            <Plus />
            Create Campaign
          </Button>
        }
      />

      <ScheduleCallsPanel />

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <Select value={status} onValueChange={(value) => setStatus((value ?? "all") as CampaignFilter)}>
          <SelectTrigger aria-label="Filter by campaign status" className="w-full sm:w-56">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard contentClassName="p-0" className="overflow-hidden">
        {isError ? (
          <ErrorState title="Couldn't load campaigns" description="Something went wrong while loading campaigns." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CardSkeleton lines={8} />
        ) : (
          <CampaignsTable campaigns={visible} emptyTitle={EMPTY_TITLES[status]} />
        )}
      </SectionCard>
    </div>
  );
}
