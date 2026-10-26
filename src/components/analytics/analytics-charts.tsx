"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsOverview } from "@/lib/services";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Activity, PieChart } from "lucide-react";

export function ConversionTrendChart({ points }: { points: AnalyticsOverview["conversionTrend"] }) {
  const hasData = points.some((point) => point.conversionRate > 0);
  return (
    <SectionCard title="Conversion trend" description="Share of that day's new leads that are booked or completed">
      {!hasData ? (
        <EmptyState icon={Activity} title="No booked leads in this range." description="Try a wider date range in the header." />
      ) : (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={48} />
              <Tooltip formatter={(value) => [`${value}%`, "Conversion"]} />
              <Line type="monotone" dataKey="conversionRate" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

export function LeadSourcesChart({ sources }: { sources: AnalyticsOverview["leadSources"] }) {
  return (
    <SectionCard title="Lead sources" description="Where inquiries in this range came from">
      {sources.length === 0 ? (
        <EmptyState icon={PieChart} title="No leads in this range." description="New inquiries will show up here by source." />
      ) : (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sources} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip formatter={(value, _name, item) => [value, item?.payload?.label ? `${item.payload.percent}% of leads` : "Leads"]} />
              <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}
