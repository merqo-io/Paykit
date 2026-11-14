"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AuthShell,
  LoginForm,
  navigatingAway,
  type LoginCredentials,
  type LoginMode,
} from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/landing/wordmark";
import { friendlyAuthError } from "./auth-errors";

const OAUTH_ERROR_MESSAGE = "Could not sign in with Google. Try again.";
const CONNECT_ERROR_MESSAGE = "Could not connect. Try again.";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

// Callbacks return final vendor copy, never a raw provider message, so the
// form's `mapError` can pass strings straight through. The shared form only
// hands `mapError` a string, which would drop the HTTP status that the
// rate-limit rule in auth-errors.ts matches on.
async function guarded(
  run: () => Promise<string | void>,
): Promise<string | void> {
  try {
    return await run();
  } catch {
    return CONNECT_ERROR_MESSAGE;
  }
}

function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  // Set once signUp() succeeds without a session (email confirmation on).
  // The shared form can only show an inline notice, so the full "check your
  // email" card stays local.
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const isSignin = mode === "signin";

  const signIn = ({ email, password }: LoginCredentials) =>
    guarded(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return friendlyAuthError(error, "signin");
      router.push("/dashboard");
      router.refresh();
    });

  const signUp = ({ email, password }: LoginCredentials) =>
    guarded(async () => {
      const supabase = createClient();
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return friendlyAuthError(error, "signup");
      if (!result.session) {
        setCheckEmail(email);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });

  const google = () =>
    guarded(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { hl: "en" },
        },
      });
      if (error) return friendlyAuthError(error, "oauth");
      // The browser is leaving for Google; keep the button disabled.
      await navigatingAway();
    });

  // The reset link lands on /auth/callback, which establishes a recovery
  // session and forwards to /dashboard/profile, where "Change password"
  // already lets a signed-in (recovery counts) user set a new one.
  const forgotPassword = (email: string) =>
    guarded(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
      });
      if (error) return friendlyAuthError(error, "reset");
      toast.success(`Password reset link sent to ${email}`);
    });

  if (checkEmail) {
    return (
      <AuthShell
        wordmark={<Wordmark className="text-2xl" />}
        title="Check your email"
      >
        <p className="text-sm text-muted-foreground">
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
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wordmark={
        <>
          <Wordmark className="text-xl" />
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your payment setup and transactions.
          </p>
        </>
      }
      title={isSignin ? "Welcome back" : "Create your account"}
      subtitle={
        isSignin
          ? "Sign in to your paykit dashboard."
          : "Set up a paykit account in seconds."
      }
    >
      <LoginForm
        defaultMode={mode}
        onModeChange={setMode}
        onPasswordSignIn={signIn}
        onPasswordSignUp={signUp}
        onGoogleSignIn={google}
        onForgotPassword={forgotPassword}
        mapError={(raw) => raw}
        initialError={
          searchParams.get("error") === "oauth"
            ? OAUTH_ERROR_MESSAGE
            : undefined
        }
      />
    </AuthShell>
  );
}
