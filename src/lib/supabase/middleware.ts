import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@merqo/ui/supabase/middleware";
import { supabaseConfig } from "./config";

export function updateSession(request: NextRequest) {
  return updateSupabaseSession(request, {
    ...supabaseConfig(),
    protectedPrefixes: ["/dashboard"],
  });
}
