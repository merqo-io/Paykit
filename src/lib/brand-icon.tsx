/* eslint-disable no-restricted-syntax -- ImageResponse needs literal CSS colours */
import type { ReactElement } from "react";

// Dark theme's brighter primary, so the dark-ink text stays legible at icon scale.
export const BRAND_MINT = "#3E9C82";
export const BRAND_INK = "#1A1D1B";

/**
 * The paykit "P" app mark for ImageResponse-generated icons (favicon,
 * apple-touch). paykit's display font is Fraunces (shared family face, see
 * docs/business/2026-08-13-typography-family-standard.md), a serif, so this
 * uses the same Georgia stand-in as qkit.
 */
export function brandIcon(size: number): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_MINT,
        color: BRAND_INK,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        fontSize: size * 0.62,
        lineHeight: 1,
        borderRadius: size * 0.22,
      }}
    >
      P
    </div>
  );
}
