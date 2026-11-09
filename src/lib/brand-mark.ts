/* eslint-disable no-restricted-syntax -- ImageResponse needs literal CSS colours */
import type { BrandIconOptions } from "@merqo/ui";

/**
 * The paykit "P" app mark for the ImageResponse icons (favicon, apple-touch).
 * The background is the dark theme's brighter primary so the dark-ink letter
 * stays legible at icon scale. paykit's display font is a serif, so the icon
 * uses a Georgia stand-in rather than shipping font data to the icon route.
 */
export const PAYKIT_ICON: BrandIconOptions = {
  monogram: "P",
  background: "#3E9C82",
  foreground: "#1A1D1B",
  fontFamily: "Georgia, 'Times New Roman', serif",
  radius: "22%",
};
