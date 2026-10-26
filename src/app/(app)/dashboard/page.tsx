"use client";

import Link from "next/link";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import { useResolvedDateRange } from "@/store/date-range-store";
import { NotAuthenticatedError } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KPIGrid, KPIGridSkeleton } from "@/components/dashboard/kpi-grid";
import { CallActivityChart } from "@/components/dashboard/call-activity-chart";
import { AppointmentFunnelWidget } from "@/components/dashboard/appointment-funnel";
import { LeadFunnelWidget } from "@/components/dashboard/lead-funnel-widget";
import { ServicePerformanceWidget } from "@/components/dashboard/service-performance";
import { MissedCallRecoveryWidget } from "@/components/dashboard/missed-call-recovery";
import { AIInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { UpcomingAppointmentsWidget } from "@/components/dashboard/upcoming-appointments";
import { CampaignPerformanceWidget } from "@/components/dashboard/campaign-performance-widget";
import { CardSkeleton } from "@/components/shared/states";
import { ErrorState } from "@/components/shared/states";

export default function DashboardPage() {
  const range = useResolvedDateRange();
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics(range);
  const needsSignIn = error instanceof NotAuthenticatedError;

  return (
    <div className="space-y-6">
      <DashboardHeader ownerFirstName={data?.ownerFirstName ?? "…"} clinicName={data?.clinicName ?? "your clinic"} />

      {needsSignIn ? (
        <ErrorState
          title="Sign in to view live data"
          description="Live Mode is on, but you're not signed in to Supabase yet."
          onRetry={() => refetch()}
        >
          <Button render={<Link href="/login" />} size="sm" className="mt-1">
            Go to sign in
          </Button>
        </ErrorState>
      ) : isError ? (
        <ErrorState
          title="Unable to load dashboard data. Please try again."
          description="Something went wrong while loading your clinic's data."
          onRetry={() => refetch()}
        />
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <KPIGridSkeleton />
          <CardSkeleton lines={6} className="h-80" />
        </div>
      ) : (
        <>
          <KPIGrid kpis={data.kpis} />

          <CallActivityChart data={data.callActivity} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AppointmentFunnelWidget funnel={data.appointmentFunnel} />
            <LeadFunnelWidget funnel={data.leadFunnel} />
          </div>

          <MissedCallRecoveryWidget data={data.missedCallRecovery} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ServicePerformanceWidget services={data.servicePerformance} />
            <AIInsightsPanel insights={data.insights} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
            <UpcomingAppointmentsWidget appointments={data.upcomingAppointments} />
            <RecentActivityFeed items={data.recentActivity} />
          </div>

          <CampaignPerformanceWidget campaigns={data.campaignPerformance} />
        </>
      )}
    </div>
  );
}
