export type AuthErrorContext =
  "signin" | "signup" | "reset" | "oauth" | "update";

import { weakPasswordMessage } from "./weak-password";

type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
  reasons?: readonly string[];
};

const GENERIC: Record<AuthErrorContext, string> = {
  signin: "Could not sign in. Try again.",
  signup: "Could not create your account. Try again.",
  reset: "Could not send the reset link. Try again.",
  oauth: "Could not sign in with Google. Try again.",
  update: "Could not update your password. Try again.",
};

type Rule = {
  contexts?: AuthErrorContext[];
  codes: string[];
  phrases: string[];
  status?: number;
  text: string | ((error: AuthErrorLike) => string);
};

const RULES: Rule[] = [
  {
    codes: ["over_request_rate_limit", "over_email_send_rate_limit"],
    phrases: ["rate limit", "too many"],
    status: 429,
    text: "Too many attempts. Wait a minute and try again.",
  },
  {
    codes: ["email_not_confirmed"],
    phrases: ["not confirmed"],
    text: "Confirm your email first. Check your inbox for the link.",
  },
  {
    contexts: ["signin"],
    codes: ["invalid_credentials"],
    phrases: ["invalid login"],
    text: "Wrong email or password. Try again.",
  },
  {
    contexts: ["signup"],
    codes: ["user_already_exists"],
    phrases: ["already registered"],
    text: "An account with this email already exists. Sign in instead.",
  },
  {
    contexts: ["signup", "update"],
    codes: ["weak_password"],
    phrases: ["password should"],
    text: weakPasswordMessage,
  },
];

function matches(rule: Rule, error: AuthErrorLike): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    rule.codes.includes(error.code ?? "") ||
    (rule.status !== undefined && rule.status === error.status) ||
    rule.phrases.some((p) => message.includes(p))
  );
}

/**
 * Turns a Supabase auth error into a plain sentence. Supabase messages are
 * written for developers and can leak account state, so only known cases get
 * specific copy and everything else falls back to a generic line.
 */
export function friendlyAuthError(
  error: AuthErrorLike,
  context: AuthErrorContext,
): string {
  const rule = RULES.find(
    (r) => (!r.contexts || r.contexts.includes(context)) && matches(r, error),
  );
  if (!rule) return GENERIC[context];
  return typeof rule.text === "function" ? rule.text(error) : rule.text;
}
