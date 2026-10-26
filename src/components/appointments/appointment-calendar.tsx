"use client";

import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Appointment } from "@/types";
import type { StatusTone } from "@/lib/status-map";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHIP_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
  neutral: "bg-muted text-muted-foreground",
};

const MAX_VISIBLE_PER_DAY = 3;

export function AppointmentCalendar({
  month,
  onMonthChange,
  appointments,
  onSelect,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const key = format(new Date(appt.starts_at), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [appointments]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => onMonthChange(subMonths(month, 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayAppointments = appointmentsByDay.get(key) ?? [];
          const visible = dayAppointments.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayAppointments.length - visible.length;

          return (
            <div
              key={key}
              className={cn(
                "min-h-28 border-b border-r border-border p-1.5 last:border-r-0",
                !isSameMonth(day, month) && "bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday(day) ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
                  !isSameMonth(day, month) && !isToday(day) && "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {visible.map((appt) => (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={() => onSelect(appt)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                      CHIP_TONE_CLASSES[APPOINTMENT_STATUS_TONE[appt.status]]
                    )}
                    title={`${formatTime(appt.starts_at)} — ${appt.patient_name}`}
                  >
                    {formatTime(appt.starts_at)} {appt.patient_name}
                  </button>
                ))}
                {overflow > 0 ? (
                  <p className="px-1.5 text-[11px] text-muted-foreground">+{overflow} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Returns the ISO start/end bounds for the whole visible calendar grid (including leading/trailing days from adjacent months). */
export function getCalendarGridRange(month: Date): { from: string; to: string } {
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  return { from: start.toISOString(), to: end.toISOString() };
}
