import { ImageResponse } from "next/og";
import { brandIcon } from "@merqo/ui";
import { PAYKIT_ICON } from "@/lib/brand-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon / tab icon.
export default function Icon() {
  return new ImageResponse(brandIcon(32, PAYKIT_ICON), { ...size });
}
