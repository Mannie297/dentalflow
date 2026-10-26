import type { ServicePerformance } from "@/types";
import { DENTAL_SERVICE_LABELS } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { Stethoscope } from "lucide-react";

export function ServicePerformanceWidget({ services }: { services: ServicePerformance[] }) {
  return (
    <SectionCard title="Service Performance" description="Which dental services are generating the most opportunity">
      {services.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No service activity yet for this period." />
      ) : (
        <div className="divide-y divide-border">
          {services.map((s) => (
            <div key={s.service} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{DENTAL_SERVICE_LABELS[s.service] ?? s.service}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(s.leads)} leads · {formatNumber(s.appointments)} appointments · {formatPercent(s.conversionRate)} conversion
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(s.estimatedValue, { compact: true })}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
