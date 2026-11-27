/**
 * Height of the fixed phone tab bar's tap row, shared with anything anchored
 * above it (PageShell's page action) so the two cannot drift apart. Applied as
 * an inline style because Tailwind cannot build a class from an imported value.
 */
export const TAB_BAR_HEIGHT = "3.5rem";

/** Bottom offset that clears the tab bar, its 1px top border and the home-indicator inset. */
export const ABOVE_TAB_BAR_OFFSET = `calc(${TAB_BAR_HEIGHT} + 1px + env(safe-area-inset-bottom))`;
