import { useMutation } from "@tanstack/react-query";
import type { DateRange } from "@/types";
import { generateReport, type ReportPeriod } from "@/lib/services";

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({ period, range }: { period: ReportPeriod; range: DateRange }) => generateReport(period, range),
  });
}
