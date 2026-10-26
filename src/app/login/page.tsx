"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUIStore } from "@/store/ui-store";

/**
 * Minimal Supabase Auth sign-in for Live Mode.
 *
 * This is intentionally bare-bones (email/password, no sign-up/password-reset
 * flows) -- building a full auth UX is out of scope for this deployment phase.
 * See /docs/DEPLOYMENT.md for how to create a Supabase Auth user and link it
 * to an organization via the `profiles` table.
 */
export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setDemoMode = useUIStore((s) => s.setDemoMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setHasSession(Boolean(data.user));
      })
      .catch(() => {
        if (!cancelled) setHasSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        setError(signInError.message === "Invalid login credentials" ? "That email or password is not right." : signInError.message);
        return;
      }
      setDemoMode(false);
      queryClient.clear();
      toast.success("Signed in. Live Mode is now active.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong signing in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueInDemo() {
    setDemoMode(true);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Stethoscope className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-lg font-semibold text-foreground">DentalFlow AI</span>
      </div>

      <div className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-foreground">Sign in to Live Mode</h1>
          <p className="text-sm text-muted-foreground">Use your Supabase Auth credentials for this organization.</p>
        </div>

        {hasSession ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            A clinic session is already open.{" "}
            <Link href="/dashboard" className="font-medium text-primary hover:underline">
              Go to the dashboard
            </Link>{" "}
            or sign in with a different account below.
          </p>
        ) : null}

        {!configured ? (
          <p className="rounded-lg bg-warning-muted px-3 py-2 text-sm text-warning">
            Supabase isn&apos;t configured for this deployment yet. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see <code>/docs/DEPLOYMENT.md</code>) before signing in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourclinic.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Just exploring?{" "}
          <button type="button" onClick={continueInDemo} className="font-medium text-primary hover:underline">
            Continue in Demo Mode
          </button>
        </p>
      </div>
    </div>
  );
}
