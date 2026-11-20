"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@merqo/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Checkbox,
  Label,
} from "@merqo/ui/primitives";

import { Field } from "./field";
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
        toast.success("Inquiry form saved");
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {form?.enabled && (
        // CopyButton takes a static value, so the origin is read at render;
        // the guard covers the server pass, where the value is never copied.
        <CopyButton
          value={inquiryLink(
            typeof window === "undefined" ? "" : window.location.origin,
            form.public_id,
          )}
          label="Copy inquiry link"
          onCopied={() => toast.success("Inquiry link copied")}
          onError={() => toast.error("Could not copy the inquiry link")}
        />
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
            <Field
              id="business_name"
              name="business_name"
              label="Business name"
              defaultValue={form?.business_name ?? ""}
              maxLength={80}
              required
            />
            <Field
              id="terms_url"
              name="terms_url"
              label="Booking terms link (optional)"
              type="url"
              placeholder="https://"
              defaultValue={form?.terms_url ?? ""}
              maxLength={500}
            />
            <Field
              id="terms_version"
              name="terms_version"
              label="Terms label"
              placeholder="v1"
              defaultValue={form?.terms_version ?? ""}
              maxLength={40}
              hint="With a link, clients must tick a box accepting these terms. We record this label and the time. Change the label whenever you change the document."
            />
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
