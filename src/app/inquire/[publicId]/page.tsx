import type { Metadata } from "next";
import { notFound } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- anonymous customer flow; the pay token or public form id is the credential
import { createServiceClient } from "@/lib/supabase/server";
import { formRenderedAt, loadPublicForm } from "@/lib/inquiries";
import { InquiryForm } from "./inquiry-form";

interface Props {
  params: Promise<{ publicId: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send an inquiry",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * A vendor's public inquiry form. No sign-in; an unknown id and a form the
 * vendor turned off both answer 404. Shows no vendor id.
 */
export default async function InquirePage({ params }: Props) {
  const { publicId } = await params;
  const supabase = await createServiceClient();
  const form = await loadPublicForm(supabase, publicId);
  if (!form) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
      <InquiryForm
        publicId={publicId}
        businessName={form.business_name}
        terms={
          form.terms_url && form.terms_version
            ? { url: form.terms_url, version: form.terms_version }
            : null
        }
        startedAt={formRenderedAt()}
      />
    </main>
  );
}
