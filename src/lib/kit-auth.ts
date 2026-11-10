import {
  hashApiKey,
  verifyKitAuth as verifySharedKitAuth,
  type KitKeyStore,
} from "@merqo/ui/kit-api";
import { createServiceClient } from "@/lib/supabase/server";
import { rpcRateLimitStore, PER_ROUTE_WINDOW_SECONDS } from "@/lib/rate-limit";

// Every attempt counts, failed or not, so key guessing is bounded per address.
const AUTH_ATTEMPT_LIMIT = 300;

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Failure logging and the last_used_at touch are best effort: the shared
// verifier never lets a degraded audit write turn into a false auth failure.
function keyStore(supabase: ServiceClient): KitKeyStore {
  return {
    async getSecretHash(kitSlug) {
      const { data, error } = await supabase
        .from("kit_api_keys")
        .select("secret_hash")
        .eq("kit_slug", kitSlug)
        .maybeSingle();
      return error || !data ? null : data.secret_hash;
    },
    async touch(kitSlug) {
      const { error } = await supabase
        .from("kit_api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("kit_slug", kitSlug);
      if (error) console.warn("paykit: last_used_at update failed");
    },
    async logFailure({ kitSlug, reason, ip }) {
      const { error } = await supabase
        .from("auth_failures")
        .insert({ kit_slug: kitSlug, reason, ip: ip ?? "unknown" });
      if (error) console.error("auth_failures insert failed");
    },
  };
}

export { hashApiKey };

export async function verifyKitAuth(
  request: Request,
): Promise<{ kitSlug: string } | null> {
  const supabase = await createServiceClient();
  return verifySharedKitAuth(request, {
    store: keyStore(supabase),
    rateLimit: {
      store: rpcRateLimitStore(supabase),
      limit: AUTH_ATTEMPT_LIMIT,
      windowSeconds: PER_ROUTE_WINDOW_SECONDS,
      failOpen: true,
    },
    trustedHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"],
  });
}
