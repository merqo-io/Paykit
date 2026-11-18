import { AuthShell } from "@merqo/ui";

import { Wordmark } from "@/components/landing/wordmark";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      wordmark={<Wordmark className="text-xl" />}
      title="Set a new password"
      subtitle="Choose a new password for your account."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
