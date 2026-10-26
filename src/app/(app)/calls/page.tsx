"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCalls } from "@/hooks/use-calls";
import { useResolvedDateRange } from "@/store/date-range-store";
import type { CallFilters } from "@/lib/services";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { CardSkeleton, ErrorState } from "@/components/shared/states";
import { CallsTable } from "@/components/calls/calls-table";
import { LogCallDialog } from "@/components/calls/log-call-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatDuration, formatNumber } from "@/lib/format";

type CallTab = "all" | "inbound" | "outbound" | "missed" | "ai" | "human";

const TABS: { value: CallTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "missed", label: "Missed" },
  { value: "ai", label: "AI Calls" },
  { value: "human", label: "Human Calls" },
];

function filtersForTab(tab: CallTab): Partial<CallFilters> {
  switch (tab) {
    case "inbound":
      return { direction: "inbound" };
    case "outbound":
      return { direction: "outbound" };
    case "missed":
      return { status: "missed" };
    case "ai":
      return { aiHandled: true };
    case "human":
      return { aiHandled: false };
    default:
      return {};
  }
}

export default function CallsPage() {
  const range = useResolvedDateRange();
  const [tab, setTab] = useState<CallTab>("all");
  const [search, setSearch] = useState("");

  const filters = useMemo<CallFilters>(
    () => ({ from: range.from, to: range.to, search: search.trim() || undefined, ...filtersForTab(tab) }),
    [range, tab, search]
  );

  const { data: calls, isLoading, isError, refetch } = useCalls(filters);
  const { data: rangeCalls } = useCalls({ from: range.from, to: range.to });

  const stats = useMemo(() => {
    const list = rangeCalls ?? [];
    const answered = list.filter((c) => c.status === "completed").length;
    const missed = list.filter((c) => c.status === "missed").length;
    const durations = list.filter((c) => c.duration_seconds > 0).map((c) => c.duration_seconds);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const aiHandled = list.length ? (list.filter((c) => c.ai_handled).length / list.length) * 100 : 0;
    return [
      { label: "Total calls", value: formatNumber(list.length) },
      { label: "Answered", value: formatNumber(answered) },
      { label: "Missed", value: formatNumber(missed) },
      { label: "Avg. duration", value: avgDuration > 0 ? formatDuration(avgDuration) : "—" },
      { label: "AI handled", value: list.length ? `${aiHandled.toFixed(0)}%` : "—" },
    ];
  }, [rangeCalls]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calls"
        description="Every inbound and outbound call, handled by your AI receptionist or staff."
        actions={<LogCallDialog />}
      />

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <SectionCard contentClassName="p-0" className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as CallTab)}>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <Search className="h-4 w-4" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search calls"
            />
          </InputGroup>
        </div>

        {isError ? (
          <ErrorState
            title="Couldn't load calls"
            description="Something went wrong while loading call activity."
            onRetry={() => refetch()}
            className="border-0 py-16"
          />
        ) : isLoading || !calls ? (
          <div className="p-5">
            <CardSkeleton lines={6} />
          </div>
        ) : (
          <CallsTable calls={calls} />
        )}
      </SectionCard>
    </div>
  );
}
