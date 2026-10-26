"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CallActivitySummary } from "@/types";
import { formatDuration, formatNumber } from "@/lib/format";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

type SeriesKey = "inbound" | "outbound" | "missed" | "answered";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "answered", label: "Answered", color: "var(--chart-2)" },
  { key: "inbound", label: "Inbound", color: "var(--chart-1)" },
  { key: "outbound", label: "Outbound", color: "var(--chart-3)" },
  { key: "missed", label: "Missed", color: "var(--chart-4)" },
];

export function CallActivityChart({ data }: { data: CallActivitySummary }) {
  const [active, setActive] = useState<Set<SeriesKey>>(new Set(["inbound", "outbound", "missed"]));

  const toggle = (key: SeriesKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasData = data.points.some((p) => p.inbound + p.outbound + p.missed + p.answered > 0);

  const stats = useMemo(
    () => [
      { label: "Answered", value: formatNumber(data.totalAnswered) },
      { label: "Missed", value: formatNumber(data.totalMissed) },
      { label: "Outbound", value: formatNumber(data.totalOutbound) },
      { label: "Avg. call duration", value: data.averageDurationSeconds > 0 ? formatDuration(data.averageDurationSeconds) : "—" },
    ],
    [data]
  );

  return (
    <SectionCard
      title="Call Activity"
      description="Inbound, outbound, missed, and answered calls over time"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={active.has(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active.has(s.key) ? "border-transparent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      {!hasData ? (
        <EmptyState icon={Activity} title="No calls found for this period." description="Try selecting a different date range." />
      ) : (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ display: "none" }} />
                {SERIES.filter((s) => active.has(s.key)).map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    fill={`url(#fill-${s.key})`}
                    strokeWidth={2}
                    activeDot={{ r: 3 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}
