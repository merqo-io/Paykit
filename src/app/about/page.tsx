import type { Metadata } from "next";
import Link from "next/link";
import { AboutMerqo } from "@merqo/ui";
import { Nav } from "@/components/landing/nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@merqo/ui/primitives";

import { createServerClient } from "@/lib/supabase/server";
import { landingNavUser } from "@/lib/landing-nav-user";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const navUser = await landingNavUser(supabase, user);

  return (
    <>
      <Nav user={navUser} />
      <main>
        <AboutMerqo kitName="paykit">
          <Button asChild size="lg">
            <Link href="/#how">See how paykit works</Link>
          </Button>
        </AboutMerqo>
      </main>
      <SiteFooter showSignIn />
    </>
  );
}
