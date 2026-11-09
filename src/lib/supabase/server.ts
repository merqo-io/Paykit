import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@merqo/ui/supabase/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/types";
import { supabaseConfig } from "./config";

export function createServerClient() {
  return createSupabaseServerClient<Database, "paykit">(supabaseConfig());
}

// Uses the secret key, which bypasses RLS. Only use in Server Actions and
// Route Handlers. It attaches no request cookies, so the secret key drives
// auth instead of whichever user's cookies happened to be present.
export async function createServiceClient() {
  return createSupabaseServiceClient<Database, "paykit">({
    url: publicEnv.supabaseUrl,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    schema: "paykit",
  });
}
