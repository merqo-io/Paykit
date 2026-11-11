"use client";

import { GlobalError } from "@merqo/ui";

/**
 * Renders when the root layout itself throws, before globals.css has loaded,
 * so the colours are literal copies of the light tokens in globals.css.
 */
export default function GlobalErrorPage({ reset }: { reset: () => void }) {
  return (
    <GlobalError
      reset={reset}
      colors={{
        background: "oklch(0.949 0.015 88)",
        foreground: "oklch(0.227 0.006 156)",
        mutedForeground: "oklch(0.556 0 0)",
        primary: "oklch(0.431 0.066 177)",
        primaryForeground: "oklch(0.949 0.015 88)",
      }}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      radius="0.5rem"
    />
  );
}
