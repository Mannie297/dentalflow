"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Info, Sparkles, TrendingUp } from "lucide-react";
import type { AIInsightView } from "@/types";
import { INSIGHT_CATEGORY_LABELS } from "@/types";
import { answerFromInsights } from "@/lib/insights/answer-question";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { INSIGHT_SEVERITY_TONE } from "@/lib/status-map";

const SEVERITY_LABEL: Record<AIInsightView["severity"], string> = {
  opportunity: "Opportunity",
  warning: "Warning",
  information: "Information",
  critical: "Critical",
};

const SEVERITY_ICON = {
  opportunity: TrendingUp,
  warning: AlertTriangle,
  information: Info,
  critical: AlertTriangle,
} as const;

export function AIInsightsPanel({ insights }: { insights: AIInsightView[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  function ask(event: FormEvent) {
    event.preventDefault();
    const next = question.trim();
    if (!next) return;
    setAnswer(answerFromInsights(next, insights));
  }

  return (
    <SectionCard
      id="ai-insights"
      title="AI Business Insights"
      description="Automatically generated from your clinic's call, lead, and appointment activity"
      actions={
        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setQuestion("");
              setAnswer(null);
            }
          }}
        >
          <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Ask AI
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ask about these insights</DialogTitle>
              <DialogDescription>The answer comes from the insights on this card.</DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={ask}>
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How many missed calls were there?"
                aria-label="Question"
              />
              {answer ? <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">{answer}</p> : null}
              <DialogFooter>
                <Button type="submit">Ask</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {insights.length === 0 ? (
        <EmptyState icon={Sparkles} title="No AI insights are available yet." description="Check back after your clinic has more call and appointment activity." />
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => {
            const Icon = SEVERITY_ICON[insight.severity];
            return (
              <div key={insight.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{INSIGHT_CATEGORY_LABELS[insight.category as keyof typeof INSIGHT_CATEGORY_LABELS] ?? insight.category} · {insight.createdAt}</p>
                    </div>
                  </div>
                  <StatusBadge tone={INSIGHT_SEVERITY_TONE[insight.severity]} label={SEVERITY_LABEL[insight.severity]} />
                </div>
                <p className="mt-2.5 text-sm text-foreground/90">{insight.description}</p>
                {insight.metric && insight.metricValue ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {insight.metric}: {insight.metricValue}
                  </p>
                ) : null}
                <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Recommended action: </span>
                  {insight.recommendation}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
