export interface InsightAnswerSource {
  title: string;
  description: string;
  recommendation: string;
  metric: string | null;
  metricValue: string | null;
}

const SKIPPED_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "has",
  "was",
  "were",
  "are",
  "what",
  "when",
  "how",
  "why",
  "who",
  "our",
  "your",
  "about",
  "last",
  "days",
  "many",
]);

/** One answer taken from the closest insight already on the card. */
export function answerFromInsights(question: string, insights: InsightAnswerSource[]): string {
  const words = question
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word.length > 2 && !SKIPPED_WORDS.has(word)) ?? [];
  if (words.length === 0) return "Ask about calls, leads, appointments, or one of the insights on this card.";

  let best: InsightAnswerSource | null = null;
  let bestScore = 0;
  for (const insight of insights) {
    const haystack = `${insight.title} ${insight.description} ${insight.recommendation} ${insight.metric ?? ""} ${insight.metricValue ?? ""}`.toLowerCase();
    const score = words.filter((word) => haystack.includes(word)).length;
    if (score > bestScore) {
      best = insight;
      bestScore = score;
    }
  }

  if (!best) return "The insights on this card do not cover that. They summarize the last 30 days of calls, leads, and appointments.";
  const metric = best.metric && best.metricValue ? ` ${best.metric}: ${best.metricValue}.` : "";
  return `${best.description}${metric} ${best.recommendation}`;
}
