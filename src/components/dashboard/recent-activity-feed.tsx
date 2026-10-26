import {
  CalendarCheck,
  CalendarX,
  MessageSquare,
  Megaphone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Star,
  UserPlus,
} from "lucide-react";
import type { ActivityItemView } from "@/types";
import { SectionCard } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status-map";

const ICON_MAP: Record<ActivityItemView["icon"], typeof PhoneIncoming> = {
  "phone-incoming": PhoneIncoming,
  "phone-outgoing": PhoneOutgoing,
  "phone-missed": PhoneMissed,
  "calendar-check": CalendarCheck,
  "message-square": MessageSquare,
  star: Star,
  megaphone: Megaphone,
  "user-plus": UserPlus,
  "calendar-x": CalendarX,
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function RecentActivityFeed({ items }: { items: ActivityItemView[] }) {
  return (
    <SectionCard title="Recent Activity" description="Live feed of what your AI receptionist and staff have been doing">
      {items.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No recent activity to show yet." />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <li key={item.id} className="flex items-start gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[item.status])}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {item.description}
                    {item.patientName ? <span className="font-medium"> — {item.patientName}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.relativeTime}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
