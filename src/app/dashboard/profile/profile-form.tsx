"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Store, UserRound } from "lucide-react";
import { Button, Input, Label } from "@merqo/ui/primitives";

import {
  ImageUploader,
  Section,
  SocialLinksFields,
  resizeToWebp,
} from "@merqo/ui";
import {
  uploadPaykitImage,
  removeReplacedAvatar,
} from "@/lib/image-upload-adapter";
import { createClient } from "@/lib/supabase/client";
import { useAsyncAction } from "@merqo/ui";
import {
  profileNameSchema,
  displayNameSchema,
  passwordChangeSchema,
  socialLinksSchema,
} from "@/lib/schemas";
import { callHandler, FORM_ERROR_CLASS, FORM_LABEL_CLASS } from "@/lib/utils";
import type { SocialLinks } from "@/lib/types";
import { updateStallName, updateSocialLinks } from "./actions";

interface Props {
  vendorId: string;
  stallName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  socialLinks: SocialLinks;
}

function FieldError({ id, message }: { id?: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className={FORM_ERROR_CLASS}>
      {message}
    </p>
  );
}

export function ProfileForm({
  vendorId,
  stallName,
  displayName,
  email,
  avatarUrl,
  socialLinks,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Business name — shared merqo.vendor_profile, persisted via a server
  // action (RLS + RPC ownership check, not a client-side write).
  const [name, setName] = useState(stallName);
  const [nameError, setNameError] = useState<string | null>(null);
  const { pending: savingName, run: runName } = useAsyncAction(callHandler);

  // Profile picture (auth user_metadata.avatar_url) — the ImageUploader handles
  // the storage upload (shared `vendor-images` bucket); we persist the
  // returned URL on the auth user, same channel as the display name.
  const [avatar, setAvatar] = useState(avatarUrl);

  // Display name (auth user_metadata) — persisted via the browser auth client.
  const [display, setDisplay] = useState(displayName);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const { pending: savingDisplay, run: runDisplay } =
    useAsyncAction(callHandler);

  // Change password — persisted via the browser auth client.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const { pending: savingPw, run: runPw } = useAsyncAction(callHandler);

  // Social/website links — shared merqo.vendor_profile, same write path as
  // business name.
  const [links, setLinks] = useState<SocialLinks>(socialLinks);
  const [linksError, setLinksError] = useState<string | null>(null);
  const { pending: savingLinks, run: runLinks } = useAsyncAction(callHandler);

  function saveBusinessName() {
    const parsed = profileNameSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError("Enter a business name");
      return;
    }
    setNameError(null);
    return runName(async () => {
      const res = await updateStallName({ name: parsed.data.name });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Business name saved");
      router.refresh();
    });
  }

  async function saveAvatar(url: string | null) {
    const previousAvatar = avatar;
    setAvatar(url);
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: url },
    });
    if (error) {
      setAvatar(previousAvatar);
      // The upload landed but the save did not, so the new object is
      // referenced nowhere.
      if (url && url !== previousAvatar) void removeReplacedAvatar(url);
      toast.error("Could not save picture. Try again");
      return;
    }
    if (previousAvatar && previousAvatar !== url)
      void removeReplacedAvatar(previousAvatar);
    toast.success(url ? "Picture saved" : "Picture removed");
    router.refresh();
  }

  function saveDisplayName() {
    const parsed = displayNameSchema.safeParse({ displayName: display });
    if (!parsed.success) {
      setDisplayError(
        parsed.error.issues[0]?.message ?? "Enter a shorter name",
      );
      return;
    }
    setDisplayError(null);
    return runDisplay(async () => {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: parsed.data.displayName },
      });
      if (error) {
        toast.error("Could not save display name. Try again");
        return;
      }
      toast.success("Display name saved");
      router.refresh();
    });
  }

  function savePassword() {
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    setPwError(null);
    return runPw(async () => {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        toast.error("Could not update password. Try again");
        return;
      }
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    });
  }

  function saveLinks() {
    const parsed = socialLinksSchema.safeParse(links);
    if (!parsed.success) {
      setLinksError(parsed.error.issues[0]?.message ?? "Check your links");
      return;
    }
    setLinksError(null);
    return runLinks(async () => {
      const res = await updateSocialLinks(parsed.data);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Links saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Section
        icon={<Store className="size-5" />}
        title="Business"
        description="Shared with every Merqo app you use."
      >
        <div className="space-y-2">
          <Label htmlFor="business-name" className={FORM_LABEL_CLASS}>
            Business name
          </Label>
          <Input
            id="business-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-xl"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "business-name-error" : undefined}
          />
          <FieldError id="business-name-error" message={nameError} />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={saveBusinessName}
            disabled={savingName || name === stallName}
            className="h-11 rounded-xl font-semibold"
          >
            {savingName ? "Saving…" : "Save business name"}
          </Button>
        </div>

        <div
          role="group"
          aria-labelledby="links-heading"
          aria-describedby={linksError ? "links-error" : undefined}
          className="space-y-4 border-t pt-6"
        >
          <div>
            <p id="links-heading" className={FORM_LABEL_CLASS}>
              Links
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown to your customers in other Merqo apps.
            </p>
          </div>
          <SocialLinksFields
            value={links}
            onChange={setLinks}
            idPrefix="profile"
          />
          <FieldError id="links-error" message={linksError} />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={saveLinks}
              disabled={savingLinks}
              className="h-11 rounded-xl font-semibold"
            >
              {savingLinks ? "Saving…" : "Save links"}
            </Button>
          </div>
        </div>
      </Section>

      <Section
        icon={<UserRound className="size-5" />}
        title="Account"
        description="Only for you. Customers never see these."
      >
        <div
          role="group"
          aria-labelledby="picture-heading"
          className="space-y-2"
        >
          <p id="picture-heading" className={FORM_LABEL_CLASS}>
            Picture
          </p>
          <div className="flex items-center gap-4">
            <ImageUploader
              bucket="vendor-images"
              pathPrefix={vendorId}
              value={avatar}
              onChange={saveAvatar}
              onUpload={uploadPaykitImage}
              resizeImage={resizeToWebp}
              imageComponent={Image}
              variant="thumb"
            />
            <p className="text-xs text-muted-foreground">
              Square images look best. Without one, your initials show instead.
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t pt-6">
          <Label htmlFor="display-name" className={FORM_LABEL_CLASS}>
            Display name
          </Label>
          <Input
            id="display-name"
            value={display}
            maxLength={60}
            placeholder="e.g. Aisha"
            onChange={(e) => setDisplay(e.target.value)}
            className="h-11 rounded-xl"
            aria-invalid={!!displayError}
            aria-describedby={displayError ? "display-name-error" : undefined}
          />
          <FieldError id="display-name-error" message={displayError} />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={saveDisplayName}
            disabled={savingDisplay || display === displayName}
            className="h-11 rounded-xl font-semibold"
          >
            {savingDisplay ? "Saving…" : "Save display name"}
          </Button>
        </div>

        <div className="space-y-4 border-t pt-6">
          <div className="space-y-2">
            <Label htmlFor="email" className={FORM_LABEL_CLASS}>
              Email
            </Label>
            <Input
              id="email"
              value={email}
              readOnly
              disabled
              className="h-11 rounded-xl bg-secondary/60"
            />
            <p className="text-xs text-muted-foreground">
              This is the email you sign in with. It can&apos;t be changed here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              placeholder="At least 8 characters"
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              aria-invalid={!!pwError}
              aria-describedby={pwError ? "confirm-password-error" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 rounded-xl"
              aria-invalid={!!pwError}
              aria-describedby={pwError ? "confirm-password-error" : undefined}
            />
            <FieldError id="confirm-password-error" message={pwError} />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={savePassword}
              disabled={savingPw || !password || !confirm}
              className="h-11 rounded-xl font-semibold"
            >
              {savingPw ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
