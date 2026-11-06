import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
import { PageHeader } from "@merqo/ui";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export const revalidate = 0;

export default async function ProfilePage() {
  const { supabase, user } = await getVendorSession();

  // paykit has no local vendors table (vendor_id is just the auth user id),
  // so there's no local business-name fallback to pass as a default here —
  // unlike a kit migrating existing local data, this is a fresh read.
  const profile = await getOrCreateVendorProfile(supabase, user.id, null);

  // display_name and avatar_url are arbitrary JSON on the auth user — read
  // defensively.
  const raw = user.user_metadata?.display_name;
  const displayName = typeof raw === "string" ? raw : "";
  const rawAvatar = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatar === "string" ? rawAvatar : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        responsive
        eyebrow="Your account"
        title="Profile"
        description="Your business name and links are shared with every Merqo app you use. Everything else stays in paykit."
        className="mb-0"
      />

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
