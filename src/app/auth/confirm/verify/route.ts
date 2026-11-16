import { handleAuthConfirm } from "@merqo/ui/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleAuthConfirm(request, {
    createClient: async () => createServerClient(),
    defaultNext: "/dashboard",
    recovery: { path: "/dashboard/profile" },
  });
}
