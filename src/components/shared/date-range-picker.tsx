"use client";

import { useState } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { Calendar as CalendarIcon, Check, ChevronLeft } from "lucide-react";
import type { DateRangePreset } from "@/types";
import { DATE_RANGE_PRESET_LABELS } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDateRangeStore, useResolvedDateRange } from "@/store/date-range-store";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESETS: DateRangePreset[] = ["today", "yesterday", "last_7_days", "last_30_days", "last_90_days"];

export function DateRangePicker() {
  const preset = useDateRangeStore((s) => s.preset);
  const setPreset = useDateRangeStore((s) => s.setPreset);
  const setCustomRange = useDateRangeStore((s) => s.setCustomRange);
  const range = useResolvedDateRange();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShowCustom(false);
      }}
    >
      <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2 font-normal" })}>
        <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>{DATE_RANGE_PRESET_LABELS[preset]}</span>
        <span className="hidden text-muted-foreground sm:inline">
          ({formatDate(range.from)} – {formatDate(range.to)})
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("w-56 p-1.5", showCustom && "w-auto")}>
        {showCustom ? (
          <div>
            <button
              type="button"
              onClick={() => setShowCustom(false)}
              className="mb-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to presets
            </button>
            <Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={2} defaultMonth={new Date(range.from)} />
            <div className="flex items-center justify-end gap-2 border-t border-border p-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (draft?.from && draft?.to) {
                    setCustomRange(draft.from.toISOString(), draft.to.toISOString());
                    setOpen(false);
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPreset(p);
                  setOpen(false);
                }}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {DATE_RANGE_PRESET_LABELS[p]}
                {preset === p ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              Custom range…
              {preset === "custom" ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
