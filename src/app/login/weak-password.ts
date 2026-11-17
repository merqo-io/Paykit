export const PASSWORD_REQUIREMENTS_HINT =
  "Use at least 8 characters, with a lowercase letter, an uppercase letter, a number and a symbol.";

type WeakPasswordInput = { reasons?: readonly string[]; message?: string };

const LENGTH_COPY = "Password is too short. Use a longer one.";
const CHARACTERS_COPY =
  "Password needs a wider mix of characters, such as upper and lower case letters, numbers and symbols.";
const PWNED_COPY =
  "This password has appeared in a data breach. Choose a different one.";
const GENERIC_COPY =
  "That password is too weak. Choose a longer, less common one.";

function joinList(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function lengthCopy(message: string): string {
  const min = /at least (\d+) characters/i.exec(message)?.[1];
  return min
    ? `Password is too short. Use at least ${min} characters.`
    : LENGTH_COPY;
}

function charactersCopy(message: string): string {
  const listed = /character of each:([\s\S]*)$/i.exec(message)?.[1];
  if (!listed) return CHARACTERS_COPY;
  const classes: string[] = [];
  if (listed.includes("abcdefghijklmnopqrstuvwxyz"))
    classes.push("a lowercase letter");
  if (listed.includes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))
    classes.push("an uppercase letter");
  if (listed.includes("0123456789")) classes.push("a number");
  if (/0123456789\s*,\s*\S/.test(listed)) classes.push("a symbol");
  if (classes.length === 0) return CHARACTERS_COPY;
  return `Password must include ${joinList(classes)}.`;
}

function inferReasons(message: string): string[] {
  if (/at least \d+ characters/i.test(message)) return ["length"];
  if (/character of each/i.test(message)) return ["characters"];
  return [];
}

/**
 * Names the password rule Supabase rejected, using only what the server
 * reported so the copy never drifts from the project's policy.
 */
export function weakPasswordMessage({
  reasons,
  message = "",
}: WeakPasswordInput): string {
  const known = (reasons ?? []).filter(
    (r) => r === "length" || r === "characters" || r === "pwned",
  );
  const found = known.length > 0 ? known : inferReasons(message);
  if (found.length === 0) return GENERIC_COPY;
  return found
    .map((reason) => {
      if (reason === "length") return lengthCopy(message);
      if (reason === "characters") return charactersCopy(message);
      return PWNED_COPY;
    })
    .join(" ");
}
