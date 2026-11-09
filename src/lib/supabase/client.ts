import { createSupabaseBrowserClient } from "@merqo/ui/supabase";
import type { Database } from "@/lib/types";
import { supabaseConfig } from "./config";

export function createClient() {
  return createSupabaseBrowserClient<Database, "paykit">(supabaseConfig());
}
