"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { submitLeadIntake } from "@/lib/services";
import { isN8nLeadIntakeConfigured } from "@/lib/config";
import { useUIStore } from "@/store/ui-store";
import { DENTAL_SERVICE_LABELS } from "@/types";
import type { DentalServiceType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  service: "" as DentalServiceType | "",
  message: "",
};

/**
 * Lets staff submit a new lead through the SAME path a public website form
 * would use: `submitLeadIntake()` -> n8n "CORE -- Lead Intake" webhook ->
 * Supabase -> AI qualification -> dashboard. This is the easiest way to
 * exercise the full live vertical slice end-to-end from inside the app --
 * see /docs/DEPLOYMENT.md "End-to-end test".
 */
export function AddLeadDialog() {
  const { data: session } = useSession();
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const n8nReady = isN8nLeadIntakeConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    try {
      const result = await submitLeadIntake({
        organization_id: session.organization.id,
        source: "website",
        first_name: form.firstName,
        last_name: form.lastName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        service_requested: form.service || undefined,
        message: form.message || undefined,
      });

      if (!result.success) {
        toast.error("Couldn't submit lead", { description: result.error });
        return;
      }

      toast.success("Lead submitted", {
        description: "n8n is validating and qualifying this lead -- it will appear on the board shortly.",
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new lead</DialogTitle>
          <DialogDescription>
            Submits through the same n8n lead-intake webhook a public website form would use.
          </DialogDescription>
        </DialogHeader>

        {isDemoMode ? (
          <p className="rounded-lg bg-info-muted px-3 py-2 text-sm text-info">
            Demo Mode is on -- switch to Live Mode to send this to n8n/Supabase. Submitting now will show a
            configuration message instead of creating a real lead.
          </p>
        ) : !n8nReady ? (
          <p className="rounded-lg bg-warning-muted px-3 py-2 text-sm text-warning">
            <code>NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL</code> isn&apos;t set for this deployment yet -- see{" "}
            <code>/docs/DEPLOYMENT.md</code>.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-first-name">First name</Label>
              <Input
                id="lead-first-name"
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-last-name">Last name</Label>
              <Input
                id="lead-last-name"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                type="tel"
                placeholder="+14165551234"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Provide at least one of phone or email.</p>
          <div className="space-y-1.5">
            <Label htmlFor="lead-service">Service requested</Label>
            <Select value={form.service} onValueChange={(v) => setForm((f) => ({ ...f, service: v as DentalServiceType }))}>
              <SelectTrigger id="lead-service" className="w-full">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DENTAL_SERVICE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-message">Message</Label>
            <Textarea
              id="lead-message"
              rows={3}
              placeholder="I would like to know the cost and availability."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting || (!form.phone && !form.email) || !form.firstName}>
              {isSubmitting ? "Submitting…" : "Submit lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
