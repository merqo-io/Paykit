/** Toasts read as short notices, so the trailing period of action messages is dropped. */
export function toastText(message: string | undefined): string {
  const text = message ?? "";
  return text.endsWith(".") ? text.slice(0, -1) : text;
}
