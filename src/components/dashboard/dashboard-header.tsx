import Link from "next/link";
import { Megaphone, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/shared/date-range-picker";

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({ ownerFirstName, clinicName }: { ownerFirstName: string; clinicName: string }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {greetingForNow()}, Dr. {ownerFirstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what happened at {clinicName}.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker />
        <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<Link href="/calls" />}>
          <Phone className="h-4 w-4" aria-hidden="true" />
          View Calls
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<Link href="/campaigns/new" />}>
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          Launch Campaign
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          nativeButton={false}
          render={
            <Link
              href="/dashboard#ai-insights"
              onClick={(event) => {
                const target = document.getElementById("ai-insights");
                if (target) {
                  event.preventDefault();
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", "#ai-insights");
                }
                // If the panel hasn't mounted yet (data still loading), let the
                // navigation set the hash and fall through to the dashboard
                // page's own effect, which scrolls once the data is ready.
              }}
            />
          }
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          View AI Insights
        </Button>
      </div>
    </div>
  );
}
