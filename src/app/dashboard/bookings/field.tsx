import type { ComponentProps, ReactNode } from "react";
import { Input, Label, cn } from "@merqo/ui/primitives";

/** Shared look for every bookings form input: tall, rounded, no shadow. */
const FIELD_INPUT_CLASS = "h-11 rounded-xl shadow-none";

/**
 * Label, input, hint and inline error with the aria wiring in one place, so
 * every bookings form announces errors the same way.
 */
export function Field({
  id,
  label,
  hint,
  error,
  prefix,
  className,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Fixed text inside the left edge of the input, such as a currency. */
  prefix?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
          >
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(
            FIELD_INPUT_CLASS,
            prefix ? "pl-10" : undefined,
            className,
          )}
          {...inputProps}
        />
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Dollar amount input: S$ prefix and a decimal on-screen keyboard. */
export function MoneyField(
  props: Omit<ComponentProps<typeof Field>, "prefix" | "type" | "inputMode">,
) {
  return <Field {...props} prefix="S$" type="text" inputMode="decimal" />;
}
