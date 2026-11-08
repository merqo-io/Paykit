import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cronBearerOk } from "@/lib/merqo-auth";
import { drainProofDeletions } from "@/lib/proof-storage-cleanup";

export const revalidate = 0;

// Called daily by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`.
// Cron runs only on Production; elsewhere call the route by hand with the secret.
export async function GET(request: Request) {
  if (!cronBearerOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const result = await drainProofDeletions(supabase);
    return NextResponse.json(result);
  } catch (error) {
    console.error("proof storage drain unavailable", error);
    return NextResponse.json({ error: "Drain unavailable" }, { status: 500 });
  }
}
