import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { AfterPayment } from "@/components/landing/after-payment";
import { PaymentJourney } from "@/components/landing/payment-journey";
import { LandingClosing, LandingFaq } from "@/components/landing/sections";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@merqo/ui";
import { createServerClient } from "@/lib/supabase/server";
import { landingNavUser } from "@/lib/landing-nav-user";

export default async function HomePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = await landingNavUser(supabase, user);

  return (
    <>
      <Nav user={navUser} />
      <main>
        <Hero />
        <PaymentJourney />
        <AfterPayment />
        <LandingFaq />
        <LandingClosing />
      </main>
      <SiteFooter showSignIn />
      <BackToTop />
    </>
  );
}
