"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/store/ui-store";

export default function LogoutPage() {
  const setDemoMode = useUIStore((state) => state.setDemoMode);
  const queryClient = useQueryClient();
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isSupabaseConfigured()) {
          await getSupabaseBrowserClient().auth.signOut();
        }
      } finally {
        setDemoMode(true);
        queryClient.clear();
        if (!cancelled) setSignedOut(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient, setDemoMode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Stethoscope className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">{signedOut ? "You've been signed out" : "Signing out…"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {signedOut
            ? "The clinic session is closed. Sign in again for Live Mode, or look around with sample data."
            : "Closing the clinic session."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/login" />} disabled={!signedOut}>
          Sign in
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />} disabled={!signedOut}>
          Continue in Demo Mode
        </Button>
      </div>
    </div>
  );
}
