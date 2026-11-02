import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Benefits } from "@/components/landing/benefits";
import { Faq } from "@/components/landing/faq";
import { ClosingCta } from "@/components/landing/closing-cta";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@merqo/ui";
import { createServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav authed={!!user} />
      <main>
        <Hero />
        <HowItWorks />
        <Benefits />
        <Faq />
      </main>
      <ClosingCta />
      <SiteFooter showSignIn />
      <BackToTop />
    </>
  );
}
