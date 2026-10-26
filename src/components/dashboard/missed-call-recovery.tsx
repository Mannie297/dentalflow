"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MissedCallRecoveryStats } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { PhoneMissed } from "lucide-react";

export function MissedCallRecoveryWidget({ data }: { data: MissedCallRecoveryStats }) {
  return (
    <SectionCard
      title="Missed Call Recovery"
      description="Missed inbound callers are called back by voice a few minutes later"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/calls?tab=missed" />}>
            View Missed Calls
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/campaigns/new?type=missed_call_recovery" />}>
            Launch Recovery Campaign
          </Button>
        </div>
      }
    >
      {data.missedCalls === 0 ? (
        <EmptyState icon={PhoneMissed} title="No missed calls in this period. Great work!" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Missed calls" value={formatNumber(data.missedCalls)} />
            <Metric label="Recovered" value={formatNumber(data.recovered)} tone="success" />
            <Metric label="Appointments booked" value={formatNumber(data.appointmentsBooked)} tone="success" />
            <Metric label="Est. revenue recovered" value={formatCurrency(data.estimatedRevenueRecovered, { compact: true })} tone="success" />
          </div>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-success-muted px-6 py-3 text-center">
            <p className="text-2xl font-semibold text-success">{formatPercent(data.recoveryRate)}</p>
            <p className="text-xs font-medium text-success/80">Recovery rate</p>
          </div>
          {data.trend.length > 1 && (
            <div className="col-span-full h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fill-recovered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(label) => label}
                  />
                  <Area type="monotone" dataKey="recovered" name="Recovered" stroke="var(--success)" fill="url(#fill-recovered)" strokeWidth={2} />
                  <Area type="monotone" dataKey="missed" name="Missed" stroke="var(--muted-foreground)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "success" ? "mt-0.5 text-lg font-semibold text-success" : "mt-0.5 text-lg font-semibold text-foreground"}>{value}</p>
    </div>
  );
}
