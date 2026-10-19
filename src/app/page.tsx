import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { Faq } from "@/components/landing/faq";
import { ClosingCta } from "@/components/landing/closing-cta";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@merqo/ui";
import { createServerClient } from "@/lib/supabase/server";
import { getPricing } from "@/lib/pricing";
import { formatCents } from "@/lib/utils";

export default async function HomePage() {
  // Reflect the session in the landing CTAs: a signed-in vendor jumps
  // straight to the dashboard instead of being sent back through /login.
  const supabase = await createServerClient();
  const [
    {
      data: { user },
    },
    pricing,
  ] = await Promise.all([supabase.auth.getUser(), getPricing(supabase)]);
  const authed = !!user;
  const monthlyPriceLabel = `${formatCents(pricing.monthly_cents)}/mo`;

  return (
    <>
      <Nav authed={authed} />
      <main>
        <Hero authed={authed} />
        <HowItWorks />
        <Benefits monthlyPriceLabel={monthlyPriceLabel} />
        <Faq monthlyPriceLabel={monthlyPriceLabel} />
      </main>
      <ClosingCta authed={authed} />
      <SiteFooter showSignIn />
      <BackToTop />
    </>
  );
}
