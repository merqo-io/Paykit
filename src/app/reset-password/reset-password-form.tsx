"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  FORM_ERROR_CLASS,
  FORM_LABEL_CLASS,
  authErrorMessage,
  InfoTooltip,
  PASSWORD_REQUIREMENTS_HINT,
  navigatingAway,
  useAsyncAction,
} from "@merqo/ui";
import { Button, Input, Label } from "@merqo/ui/primitives";

import { passwordChangeSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

type SessionState = "checking" | "ready" | "no-session" | "failed";

const CONNECT_ERROR_MESSAGE = "Could not connect. Try again.";

// Sets a new password on the recovery session /auth/callback establishes. A
// missing session means the link was used or expired, so the vendor is sent
// back to sign in instead of seeing a form whose submit would fail.
export function ResetPasswordForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setState("failed");
          return;
        }
        setState(data.user ? "ready" : "no-session");
      })
      .catch(() => {
        if (active) setState("failed");
      });
    return () => {
      active = false;
    };
  }, [supabase, retryKey]);

  const { pending, run } = useAsyncAction(async (newPassword: string) => {
    let updateError;
    try {
      ({ error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      }));
    } catch {
      setError(CONNECT_ERROR_MESSAGE);
      return;
    }
    if (updateError) {
      setError(authErrorMessage(updateError, "update"));
      return;
    }
    // Navigation stays outside the try so a router failure after a successful
    // update is not reported as a connection error.
    toast.success("Password updated");
    router.push("/dashboard");
    router.refresh();
    await navigatingAway();
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    setError(null);
    void run(parsed.data.password);
  }

  if (state === "checking") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Checking your reset link…
      </p>
    );
  }

  if (state === "failed") {
    return (
      <div>
        <p role="alert" className={FORM_ERROR_CLASS}>
          Could not check your reset link. Try again.
        </p>
        <Button
          type="button"
          className="mt-4 h-11 w-full rounded-lg"
          onClick={() => {
            setState("checking");
            setRetryKey((key) => key + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (state === "no-session") {
    return (
      <div>
        <h2 className="text-base font-semibold">This link has expired</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reset links work once and expire quickly. Request a new one from the
          sign-in page.
        </p>
        <Button
          asChild
          variant="outline"
          className="mt-6 h-11 w-full rounded-lg"
        >
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
            New password
          </Label>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Password requirements</span>
            <InfoTooltip
              content={PASSWORD_REQUIREMENTS_HINT}
              ariaLabel="Password requirements"
              trigger="tap"
            />
          </div>
        </div>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
          Confirm password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 rounded-lg"
        />
      </div>
      {error && (
        <p role="alert" className={FORM_ERROR_CLASS}>
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || !password || !confirm}
        className="h-11 w-full rounded-lg"
      >
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
