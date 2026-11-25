import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@merqo/ui/primitives";

import { AdminChrome } from "@/app/admin/admin-chrome";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route: non-admins get a 404 from requireAdmin.
  await requireAdmin();

  return (
    <AdminChrome
      actions={
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="rounded-lg text-muted-foreground"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      }
    >
      {children}
    </AdminChrome>
  );
}
