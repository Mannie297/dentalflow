"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useGenerateReport } from "@/hooks/use-reports";
import type { GeneratedReport, ReportPeriod } from "@/lib/services";
import { resolveDateRange } from "@/lib/date-range";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buildReportPdf, reportPdfFilename } from "@/lib/reports/report-pdf";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PERIODS: { value: ReportPeriod; label: string; preset: "today" | "last_7_days" | "last_30_days" }[] = [
  { value: "daily", label: "Daily", preset: "today" },
  { value: "weekly", label: "Weekly", preset: "last_7_days" },
  { value: "monthly", label: "Monthly", preset: "last_30_days" },
];

function downloadPdf(report: GeneratedReport) {
  const lines = [
    "DentalFlow clinic report",
    `${report.period[0].toUpperCase()}${report.period.slice(1)} · ${formatDate(report.range.from, { month: "short", day: "numeric", year: "numeric" })} to ${formatDate(report.range.to, { month: "short", day: "numeric", year: "numeric" })}`,
    "",
    "Executive summary",
    report.executiveSummary,
    "",
    "Key opportunities",
    ...report.keyOpportunities.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Calls ${report.stats.totalCalls}   Qualified leads ${report.stats.qualifiedLeads}   Appointments ${report.stats.appointmentsBooked}`,
    `Missed ${report.stats.missedCalls}   Recovered ${report.stats.recovered}   Estimated revenue ${formatCurrency(report.stats.estimatedRevenue)}`,
  ];
  const blob = new Blob([buildReportPdf(lines)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportPdfFilename(report.period);
  link.click();
  URL.revokeObjectURL(url);
}

function emailReport(report: GeneratedReport) {
  const body = [report.executiveSummary, "", "Key opportunities", ...report.keyOpportunities.map((item, index) => `${index + 1}. ${item}`)].join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent("DentalFlow clinic report")}&body=${encodeURIComponent(body)}`;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const generate = useGenerateReport();
  const selected = PERIODS.find((item) => item.value === period) ?? PERIODS[0];

  function handleGenerate() {
    const range = resolveDateRange(selected.preset);
    generate.mutate(
      { period, range },
      {
        onSuccess: (next) => {
          setReport(next);
          toast.success("Report ready.");
        },
        onError: () => toast.error("Couldn't generate the report."),
      }
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Reports"
        description="Build a daily, weekly, or monthly summary from the clinic's calls, leads, and appointments."
        actions={
          <Button onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate report"}
          </Button>
        }
      />

      <Tabs
        value={period}
        onValueChange={(value) => {
          setPeriod(value as ReportPeriod);
          setReport(null);
        }}
      >
        <TabsList>
          {PERIODS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!report ? (
        <SectionCard title="No report yet" description="Choose a period, then generate the report. It uses today's date, the last 7 days, or the last 30 days.">
          <p className="text-sm text-muted-foreground">The {selected.label.toLowerCase()} report covers {formatDate(resolveDateRange(selected.preset).from, { month: "short", day: "numeric", year: "numeric" })} to {formatDate(resolveDateRange(selected.preset).to, { month: "short", day: "numeric", year: "numeric" })}.</p>
        </SectionCard>
      ) : (
        <SectionCard
          title={`${report.period[0].toUpperCase()}${report.period.slice(1)} report`}
          description={`Generated ${formatDateTime(report.generatedAt)} · ${formatDate(report.range.from, { month: "short", day: "numeric", year: "numeric" })} to ${formatDate(report.range.to, { month: "short", day: "numeric", year: "numeric" })}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadPdf(report)}>
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => emailReport(report)}>
                Email report
              </Button>
            </div>
          }
        >
          <h3 className="text-sm font-semibold text-foreground">Executive summary</h3>
          <p className="mt-2 text-sm text-foreground">{report.executiveSummary}</p>
          <h3 className="mt-5 text-sm font-semibold text-foreground">Key opportunities</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
            {report.keyOpportunities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Calls" value={formatNumber(report.stats.totalCalls)} />
            <Stat label="Qualified leads" value={formatNumber(report.stats.qualifiedLeads)} />
            <Stat label="Appointments" value={formatNumber(report.stats.appointmentsBooked)} />
            <Stat label="Missed calls" value={formatNumber(report.stats.missedCalls)} />
            <Stat label="Recovered" value={formatNumber(report.stats.recovered)} />
            <Stat label="Estimated revenue" value={formatCurrency(report.stats.estimatedRevenue)} />
          </dl>
        </SectionCard>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
