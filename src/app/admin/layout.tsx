import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Badge, Button } from "@merqo/ui/primitives";

import { AdminNav } from "@/app/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route: non-admins get a 404 from requireAdmin.
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 px-5 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wordmark className="text-xl" />
            <Badge variant="secondary" className="tracking-wider uppercase">
              Admin
            </Badge>
          </div>
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
        </div>
        <AdminNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
