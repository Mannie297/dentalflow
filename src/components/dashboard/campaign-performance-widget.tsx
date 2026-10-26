import Link from "next/link";
import { Megaphone } from "lucide-react";
import type { CampaignPerformanceView } from "@/types";
import { CAMPAIGN_TYPE_LABELS } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export function CampaignPerformanceWidget({ campaigns }: { campaigns: CampaignPerformanceView[] }) {
  return (
    <SectionCard
      title="Outbound Campaign Performance"
      description="Recall, recovery, and follow-up campaigns driving new appointments"
      actions={
        <Button size="sm" nativeButton={false} render={<Link href="/campaigns/new" />}>
          Launch Campaign
        </Button>
      }
      contentClassName="p-0"
    >
      {campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns are currently active." className="border-0 m-5" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Answered</TableHead>
                <TableHead className="text-right">Appointments</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Est. Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{CAMPAIGN_TYPE_LABELS[c.type]}</p>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(c.contacts)}</TableCell>
                  <TableCell className="text-right">{formatNumber(c.calls)}</TableCell>
                  <TableCell className="text-right">{formatNumber(c.answered)}</TableCell>
                  <TableCell className="text-right">{formatNumber(c.appointments)}</TableCell>
                  <TableCell className="text-right">{formatPercent(c.conversionRate)}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">{formatCurrency(c.estimatedRevenue, { compact: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
