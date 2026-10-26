"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useAnalyticsOverview } from "@/hooks/use-analytics";
import { useResolvedDateRange } from "@/store/date-range-store";
import type { AnalyticsFilters } from "@/lib/services";
import type { DentalServiceType, LeadSource } from "@/types";
import { DENTAL_SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/types";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { CallActivityChart } from "@/components/dashboard/call-activity-chart";
import { ServicePerformanceWidget } from "@/components/dashboard/service-performance";
import { CampaignPerformanceWidget } from "@/components/dashboard/campaign-performance-widget";
import { ConversionTrendChart, LeadSourcesChart } from "@/components/analytics/analytics-charts";

export default function AnalyticsPage() {
  const range = useResolvedDateRange();
  const [service, setService] = useState<DentalServiceType | "all">("all");
  const [source, setSource] = useState<LeadSource | "all">("all");
  const [campaignId, setCampaignId] = useState("all");
  const [dentist, setDentist] = useState("all");

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      service: service === "all" ? undefined : service,
      source: source === "all" ? undefined : source,
      campaignId: campaignId === "all" ? undefined : campaignId,
      dentist: dentist === "all" ? undefined : dentist,
    }),
    [service, source, campaignId, dentist]
  );

  const { data, isLoading, isError, refetch, isPlaceholderData } = useAnalyticsOverview(range, filters);
  const options = data?.filterOptions;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Analytics"
        description="Call, lead, and appointment performance for the date range in the header."
      />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <FilterSelect label="Filter by service" value={service} onChange={(value) => setService(value as DentalServiceType | "all")}>
          <option value="all">All services</option>
          {(options?.services ?? []).map((value) => (
            <option key={value} value={value}>
              {DENTAL_SERVICE_LABELS[value]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by source" value={source} onChange={(value) => setSource(value as LeadSource | "all")}>
          <option value="all">All sources</option>
          {(options?.sources ?? []).map((value) => (
            <option key={value} value={value}>
              {LEAD_SOURCE_LABELS[value]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by campaign" value={campaignId} onChange={setCampaignId}>
          <option value="all">All campaigns</option>
          {(options?.campaigns ?? []).map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by dentist" value={dentist} onChange={setDentist}>
          <option value="all">All dentists</option>
          {(options?.dentists ?? []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </FilterSelect>
      </div>

      {isError ? (
        <ErrorState title="Couldn't load analytics" description="Something went wrong while loading this range." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <CardSkeleton key={index} lines={2} />
            ))}
          </div>
          <CardSkeleton lines={6} className="h-80" />
        </div>
      ) : (
        <div className={isPlaceholderData ? "space-y-6 opacity-70" : "space-y-6"}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {data.metrics.map((metric) => (
              <div key={metric.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.helpText}</p>
              </div>
            ))}
          </div>
          <CallActivityChart data={data.callActivity} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ConversionTrendChart points={data.conversionTrend} />
            <LeadSourcesChart sources={data.leadSources} />
          </div>
          <ServicePerformanceWidget services={data.servicePerformance} />
          <CampaignPerformanceWidget campaigns={data.campaignPerformance} />
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:w-48"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}
