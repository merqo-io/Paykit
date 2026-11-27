"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { dismissOnboarding } from "@/app/dashboard/onboarding-actions";
import type { OnboardingState, OnboardingStep } from "@/lib/onboarding";

// 44px square target without enlarging the icon.
const DISMISS_CLASS =
  "-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function StepMarker({ step }: { step: OnboardingStep }) {
  if (step.done) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-background"
      >
        <Check className="size-4" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-muted-foreground/40"
    />
  );
}

function StepRow({ step }: { step: OnboardingStep }) {
  const body = (
    <>
      <StepMarker step={step} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={
              step.done
                ? "font-medium text-muted-foreground line-through"
                : "font-medium"
            }
          >
            {step.title}
          </span>
          {step.optional && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Optional
            </span>
          )}
          {step.comingSoon && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Coming soon
            </span>
          )}
        </span>
        {!step.done && (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {step.description}
          </span>
        )}
      </span>
    </>
  );

  if (step.comingSoon || !step.href) {
    return <li className="flex items-start gap-3 py-3 opacity-60">{body}</li>;
  }

  return (
    <li>
      <Link
        href={step.href}
        className="flex min-h-11 items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {body}
      </Link>
    </li>
  );
}

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const [dismissed, setDismissed] = useState(false);
  const autoDismissed = useRef(false);

  // The set-up state is a one-time congratulation: recording the dismissal on
  // first render means the next Home load hides it without a click.
  useEffect(() => {
    if (state.mode !== "complete" || autoDismissed.current) return;
    autoDismissed.current = true;
    void dismissOnboarding();
  }, [state.mode]);

  if (state.mode === "hidden" || dismissed) return null;

  // Hide immediately; the write is best-effort and a failure only means the
  // card shows again on the next visit.
  function dismiss() {
    setDismissed(true);
    void dismissOnboarding();
  }

  const dismissButton = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Dismiss setup guide"
      className={DISMISS_CLASS}
    >
      <X className="size-5" aria-hidden="true" />
    </button>
  );

  if (state.mode === "complete") {
    return (
      <section
        aria-labelledby="onboarding-title"
        className="mb-6 flex items-start justify-between gap-3 rounded-xl border bg-card p-4"
      >
        <div>
          <h2 id="onboarding-title" className="font-semibold">
            You&apos;re set up
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Payment setup is done and you have confirmed your first payment.
          </p>
        </div>
        {dismissButton}
      </section>
    );
  }

  const percent = Math.round((state.doneCount / state.totalCount) * 100);

  return (
    <section
      aria-labelledby="onboarding-title"
      className="mb-6 rounded-xl border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onboarding-title" className="font-semibold">
            Get set up
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.doneCount} of {state.totalCount} done
          </p>
        </div>
        {dismissButton}
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={state.totalCount}
        aria-valuenow={state.doneCount}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="mt-2 divide-y">
        {state.steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </ul>
    </section>
  );
}
