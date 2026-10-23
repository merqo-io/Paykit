"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveInquiryFormAction,
  type InquiryActionState,
} from "./inquiry-actions";
import type { InquiryForm } from "@/lib/types";

export function inquiryLink(origin: string, publicId: string): string {
  return `${origin}/inquire/${publicId}`;
}

export function InquiryFormSettings({ form }: { form: InquiryForm | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    InquiryActionState,
    FormData
  >(
    async (prev, formData) => {
      const result = await saveInquiryFormAction(prev, formData);
      if (result.status === "ok") {
        toast.success("Inquiry form saved.");
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );

  async function copyLink() {
    if (!form) return;
    await navigator.clipboard.writeText(
      inquiryLink(window.location.origin, form.public_id),
    );
    toast.success("Inquiry link copied");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {form?.enabled && (
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="size-3.5" />
          Copy inquiry link
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {form ? "Inquiry form" : "Set up inquiry form"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inquiry form</DialogTitle>
            <DialogDescription>
              A public page where clients ask about booking you. Share its link
              on Instagram, WhatsApp or your website. New inquiries show up
              here.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name</Label>
              <Input
                id="business_name"
                name="business_name"
                defaultValue={form?.business_name ?? ""}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms_url">Booking terms link (optional)</Label>
              <Input
                id="terms_url"
                name="terms_url"
                type="url"
                placeholder="https://"
                defaultValue={form?.terms_url ?? ""}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms_version">Terms version</Label>
              <Input
                id="terms_version"
                name="terms_version"
                placeholder="v1"
                defaultValue={form?.terms_version ?? ""}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                With a link, clients must tick a box accepting these terms. We
                record the version and the time. Change the version whenever you
                change the document.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="enabled"
                name="enabled"
                defaultChecked={form?.enabled ?? true}
              />
              <Label htmlFor="enabled" className="font-normal">
                Accept new inquiries
              </Label>
            </div>
            {state.status === "error" && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.message}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
