import Link from "next/link";
import { Calendar, DollarSign, Percent, Phone, PhoneMissed, Users } from "lucide-react";
import type { KPIMetric } from "@/types";
import { TrendIndicator } from "./trend-indicator";
import { cn } from "@/lib/utils";

const ICONS = {
  phone: Phone,
  "phone-missed": PhoneMissed,
  users: Users,
  "calendar-check": Calendar,
  percent: Percent,
  "dollar-sign": DollarSign,
} as const;

export function KPICard({ metric }: { metric: KPIMetric }) {
  const Icon = ICONS[metric.icon];

  return (
    <Link
      href={metric.href}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground">{metric.formattedValue}</span>
        <TrendIndicator trend={metric.trend} />
      </div>
      <p className={cn("text-xs text-muted-foreground", metric.isEstimate && "italic")}>
        {metric.isEstimate ? "Estimated · " : ""}
        {metric.subtext}
      </p>
    </Link>
  );
}
