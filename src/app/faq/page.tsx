import type { Metadata } from "next";
import { FaqPage } from "@merqo/ui";

import { Nav, navAccount } from "@/components/landing/nav";
import { SiteFooter } from "@/components/site-footer";
import { createServerClient } from "@/lib/supabase/server";

import { FAQ_GROUPS, FAQ_INTRO } from "./faq-content";

export const metadata: Metadata = {
  title: "FAQ",
};

export default async function FaqRoute() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Nav authed={!!user} account={user ? navAccount(user) : undefined} />
      <main>
        <FaqPage
          title="Frequently asked questions"
          intro={FAQ_INTRO}
          groups={FAQ_GROUPS}
        />
      </main>
      <SiteFooter showSignIn />
    </>
  );
}
