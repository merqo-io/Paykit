"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@merqo/ui/primitives";

import { Wordmark } from "@/components/landing/wordmark";
import { ElevatedCard } from "@merqo/ui";
import { GoogleMark } from "@merqo/ui";
import { friendlyAuthError } from "./auth-errors";

type Mode = "signin" | "signup";

const OAUTH_ERROR_MESSAGE = "Could not sign in with Google. Try again.";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oauth" ? OAUTH_ERROR_MESSAGE : null,
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once signUp() succeeds without a session (email confirmation on) —
  // shows a "check your email" state instead of bouncing to a dashboard the
  // unconfirmed user can't reach.
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const isSignin = mode === "signin";

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { hl: "en" },
        },
      });
      if (error) {
        setError(friendlyAuthError(error, "oauth"));
        setBusy(false);
      }
    } catch {
      setError("Could not connect. Try again.");
      setBusy(false);
    }
  }

  // Email a password-reset link. The link lands on /auth/callback, which
  // establishes a recovery session and forwards to /dashboard/profile —
  // where "Change password" (profile-form.tsx) already lets a signed-in
  // user (a recovery session counts) set a new one. No separate
  // reset-password page needed.
  async function sendReset() {
    if (!email) {
      setEmailError("Enter your email first");
      document.getElementById("email")?.focus();
      return;
    }
    setEmailError(null);
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
      });
      if (error) {
        setError(friendlyAuthError(error, "reset"));
        return;
      }
      toast.success(`Password reset link sent to ${email}`);
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setEmailError(null);
    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setError(friendlyAuthError(error, "signup"));
          return;
        }
        // Email confirmation on -> no session yet. Show a "check your email"
        // state rather than redirecting to a dashboard the unconfirmed user
        // can't reach.
        if (!result.session) {
          setCheckEmail(email);
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(friendlyAuthError(error, "signin"));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <div className="w-full max-w-md text-center">
          <ElevatedCard className="px-7 py-10">
            <Wordmark className="text-2xl" />
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
              Check your email
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{checkEmail}</span>.
              Open it to activate your account, then sign in.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-7 h-11 w-full rounded-lg"
              onClick={() => {
                setCheckEmail(null);
                setMode("signin");
              }}
            >
              Back to sign in
            </Button>
          </ElevatedCard>
        </div>
      </main>
    );
  }

  let submitLabel = isSignin ? "Sign in" : "Create account";
  if (busy) submitLabel = "Please wait…";

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Wordmark className="text-xl" />
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your payment setup and transactions.
          </p>
        </div>

        <ElevatedCard>
          <div className="px-7 pt-9 pb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {isSignin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isSignin
                ? "Sign in to your paykit dashboard."
                : "Set up a paykit account in seconds."}
            </p>

            <Button
              type="button"
              variant="outline"
              onClick={signInWithGoogle}
              disabled={busy}
              className="mt-7 h-11 w-full gap-2.5 rounded-lg text-base font-medium"
            >
              <GoogleMark />
              Continue with Google
            </Button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                or with email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@business.sg"
                  className="h-11 rounded-lg text-base"
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? "email-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                />
                {emailError && (
                  <p
                    id="email-error"
                    className="text-sm font-medium text-destructive"
                  >
                    {emailError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  {isSignin && (
                    <button
                      type="button"
                      onClick={sendReset}
                      disabled={busy}
                      className="-my-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete={isSignin ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  className="h-11 rounded-lg text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full rounded-lg text-base font-semibold"
                disabled={busy}
              >
                {submitLabel}
              </Button>
            </form>
          </div>

          <div className="border-t" />
          <p className="px-7 py-4 text-center text-sm text-muted-foreground">
            {isSignin ? "New to paykit? " : "Already have an account? "}
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode(isSignin ? "signup" : "signin");
                setError(null);
                setEmailError(null);
              }}
            >
              {isSignin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </ElevatedCard>
      </div>
    </main>
  );
}
