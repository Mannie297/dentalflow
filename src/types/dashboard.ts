/**
 * Aggregate / view-model types returned by the service layer for
 * dashboard, analytics, and reporting surfaces. These are derived data
 * shapes (not raw tables) so UI components can stay decoupled from the
 * underlying storage (mock today, Supabase/FastAPI later).
 */

import type {
  AppointmentStatus,
  CampaignType,
  DentalServiceType,
  LeadStatus,
} from "./database";

export interface TrendValue {
  value: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  /** Whether an "up" direction is good news for this particular metric. */
  isPositiveWhenUp: boolean;
}

export interface KPIMetric {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  trend: TrendValue;
  subtext: string;
  href: string;
  icon: "phone" | "phone-missed" | "users" | "calendar-check" | "percent" | "dollar-sign";
  isEstimate?: boolean;
}

export interface DashboardKPIs {
  totalCalls: KPIMetric;
  missedCalls: KPIMetric;
  newLeads: KPIMetric;
  appointmentsBooked: KPIMetric;
  conversionRate: KPIMetric;
  revenueOpportunity: KPIMetric;
}

export interface CallActivityPoint {
  date: string;
  inbound: number;
  outbound: number;
  missed: number;
  answered: number;
}

export interface CallActivitySummary {
  points: CallActivityPoint[];
  totalAnswered: number;
  totalMissed: number;
  totalOutbound: number;
  averageDurationSeconds: number;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  percentOfFirst: number;
  percentOfPrevious: number | null;
}

export interface AppointmentConversionFunnel {
  steps: FunnelStep[];
}

export interface LeadFunnelStage {
  status: LeadStatus;
  count: number;
  conversionFromPrevious: number | null;
}

export interface LeadFunnel {
  stages: LeadFunnelStage[];
  totalLeads: number;
}

export interface ServicePerformance {
  service: DentalServiceType;
  leads: number;
  appointments: number;
  conversionRate: number;
  estimatedValue: number;
}

export interface MissedCallRecoveryStats {
  missedCalls: number;
  recovered: number;
  appointmentsBooked: number;
  estimatedRevenueRecovered: number;
  recoveryRate: number;
  trend: { date: string; recovered: number; missed: number }[];
}

export interface AIInsightView {
  id: string;
  category: string;
  severity: "opportunity" | "warning" | "information" | "critical";
  title: string;
  description: string;
  recommendation: string;
  metric: string | null;
  metricValue: string | null;
  createdAt: string;
}

export interface ActivityItemView {
  id: string;
  icon:
    | "phone-incoming"
    | "phone-outgoing"
    | "phone-missed"
    | "calendar-check"
    | "message-square"
    | "star"
    | "megaphone"
    | "user-plus"
    | "calendar-x";
  description: string;
  patientName: string | null;
  timestamp: string;
  relativeTime: string;
  status: "success" | "warning" | "info" | "danger";
}

export interface UpcomingAppointmentView {
  id: string;
  time: string;
  patientName: string;
  service: string;
  patientType: "New Patient" | "Existing";
  status: AppointmentStatus;
}

export interface CampaignPerformanceView {
  id: string;
  name: string;
  type: CampaignType;
  contacts: number;
  calls: number;
  answered: number;
  appointments: number;
  conversionRate: number;
  estimatedRevenue: number;
  status: string;
}

export interface DashboardSummary {
  clinicName: string;
  ownerFirstName: string;
  kpis: DashboardKPIs;
  callActivity: CallActivitySummary;
  appointmentFunnel: AppointmentConversionFunnel;
  leadFunnel: LeadFunnel;
  servicePerformance: ServicePerformance[];
  missedCallRecovery: MissedCallRecoveryStats;
  insights: AIInsightView[];
  recentActivity: ActivityItemView[];
  upcomingAppointments: UpcomingAppointmentView[];
  campaignPerformance: CampaignPerformanceView[];
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: string;
  to: string;
}

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  custom: "Custom",
};
