import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
import { BackButton } from "@merqo/ui";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export const revalidate = 0;

export default async function ProfilePage() {
  const { supabase, user } = await getVendorSession();

  // paykit has no local vendors table (vendor_id is just the auth user id),
  // so there's no local stall-name fallback to pass as a default here —
  // unlike a kit migrating existing local data, this is a fresh read.
  const profile = await getOrCreateVendorProfile(supabase, user.id, null);

  // display_name and avatar_url are arbitrary JSON on the auth user — read
  // defensively.
  const raw = user.user_metadata?.display_name;
  const displayName = typeof raw === "string" ? raw : "";
  const rawAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatar === "string" ? rawAvatar : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 md:max-w-4xl">
      <div>
        <BackButton href="/dashboard" label="Dashboard" />
      </div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Your account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your stall/shop name and social links are shared with every Merqo kit
          you use. Display name, profile icon, and password stay local to
          paykit. Each section saves on its own.
        </p>
      </header>

      <ProfileForm
        vendorId={user.id}
        stallName={profile.stall_name}
        displayName={displayName}
        email={user.email ?? ""}
        avatarUrl={avatarUrl}
        socialLinks={profile.social_links}
      />
    </div>
  );
}
