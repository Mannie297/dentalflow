import Link from "next/link";
import type { LeadFunnel } from "@/types";
import { LEAD_STAGE_LABELS } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { Users } from "lucide-react";

export function LeadFunnelWidget({ funnel }: { funnel: LeadFunnel }) {
  const activeStages = funnel.stages.filter((s) => s.status !== "lost");
  const lostStage = funnel.stages.find((s) => s.status === "lost");

  return (
    <SectionCard
      title="Lead Pipeline"
      description="Where leads currently sit across the funnel"
      actions={
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/leads" />}>
          View pipeline
        </Button>
      }
    >
      {funnel.totalLeads === 0 ? (
        <EmptyState icon={Users} title="No leads found for this period." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {activeStages.map((stage) => (
              <div key={stage.status} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-lg font-semibold text-foreground">{formatNumber(stage.count)}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{LEAD_STAGE_LABELS[stage.status]}</p>
              </div>
            ))}
          </div>
          {lostStage && lostStage.count > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-danger">{formatNumber(lostStage.count)}</span> leads marked lost this period.
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
