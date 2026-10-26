"use client";

import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import type { Campaign } from "@/types";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from "@/types";
import { CAMPAIGN_STATUS_TONE } from "@/lib/status-map";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

export function CampaignsTable({ campaigns, emptyTitle }: { campaigns: Campaign[]; emptyTitle: string }) {
  const router = useRouter();

  if (campaigns.length === 0) {
    return <EmptyState icon={Megaphone} title={emptyTitle} description="Create a campaign to choose an audience and save a call script." className="m-5 border-0" />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Contacts</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">SMS</TableHead>
            <TableHead className="text-right">Responses</TableHead>
            <TableHead className="text-right">Appointments</TableHead>
            <TableHead className="text-right">Conversion</TableHead>
            <TableHead className="text-right">Est. revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const conversion = campaign.contacts_count ? (campaign.appointments_count / campaign.contacts_count) * 100 : 0;
            return (
              <TableRow
                key={campaign.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                aria-label={`View campaign ${campaign.name}`}
                onClick={() => router.push(`/campaigns/${campaign.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/campaigns/${campaign.id}`);
                  }
                }}
              >
                <TableCell>
                  <p className="font-medium text-foreground">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">{CAMPAIGN_TYPE_LABELS[campaign.type]}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={CAMPAIGN_STATUS_TONE[campaign.status]} label={CAMPAIGN_STATUS_LABELS[campaign.status]} />
                </TableCell>
                <TableCell className="text-right">{formatNumber(campaign.contacts_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(campaign.calls_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(campaign.sms_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(campaign.responses_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(campaign.appointments_count)}</TableCell>
                <TableCell className="text-right">{formatPercent(conversion)}</TableCell>
                <TableCell className="text-right font-medium text-foreground">{formatCurrency(campaign.estimated_revenue)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
