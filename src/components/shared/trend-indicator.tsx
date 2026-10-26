import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSignedPercent } from "@/lib/format";
import type { TrendValue } from "@/types";

/** Colors the change based on whether "up" is actually good for this metric (e.g. missed calls going up is bad). */
export function TrendIndicator({ trend, className }: { trend: TrendValue; className?: string }) {
  const isGood =
    trend.direction === "flat" ? null : trend.direction === "up" ? trend.isPositiveWhenUp : !trend.isPositiveWhenUp;

  const colorClass = isGood === null ? "text-muted-foreground" : isGood ? "text-success" : "text-danger";
  const Icon = trend.direction === "up" ? ArrowUp : trend.direction === "down" ? ArrowDown : ArrowRight;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", colorClass, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatSignedPercent(trend.changePercent)}
      <span className="sr-only"> vs previous period</span>
    </span>
  );
}
