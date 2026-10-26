import type { DashboardKPIs } from "@/types";
import { KPICard } from "@/components/shared/kpi-card";
import { KPICardSkeleton } from "@/components/shared/states";

export function KPIGrid({ kpis }: { kpis: DashboardKPIs }) {
  const cards = [
    kpis.totalCalls,
    kpis.missedCalls,
    kpis.newLeads,
    kpis.appointmentsBooked,
    kpis.conversionRate,
    kpis.revenueOpportunity,
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((metric) => (
        <KPICard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

export function KPIGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  );
}
