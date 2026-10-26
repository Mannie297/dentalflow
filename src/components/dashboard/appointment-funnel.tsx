import type { AppointmentConversionFunnel } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatNumber } from "@/lib/format";
import { GitBranch } from "lucide-react";

export function AppointmentFunnelWidget({ funnel }: { funnel: AppointmentConversionFunnel }) {
  const hasData = funnel.steps.some((s) => s.count > 0);
  const maxCount = Math.max(1, ...funnel.steps.map((s) => s.count));

  return (
    <SectionCard title="Appointment Conversion" description="How inquiries move from first contact to a completed visit">
      {!hasData ? (
        <EmptyState icon={GitBranch} title="No inquiries found for this period." />
      ) : (
        <div className="space-y-3">
          {funnel.steps.map((step, index) => {
            const widthPercent = Math.max(8, (step.count / maxCount) * 100);
            return (
              <div key={step.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{step.label}</span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatNumber(step.count)}</span>
                    {index > 0 && step.percentOfPrevious !== null ? ` · ${step.percentOfPrevious}% of previous` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${widthPercent}%`, opacity: 1 - index * 0.12 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
