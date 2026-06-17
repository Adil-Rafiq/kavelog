import type { ReactElement } from "react";

/**
 * Brand colors for generated app icons / PWA chrome.
 * Mirrors the design tokens in globals.css (signal lime on deep ink).
 */
export const BRAND = {
  lime: "#D7FF3A", // --primary
  ink: "#0E1217", // --primary-foreground (deep ink)
  bg: "#0A0D12", // --background (dark default)
} as const;

/**
 * The KaveLog "K" mark as a standalone SVG (transparent background, ink strokes).
 * Drawn with paths rather than text so it renders identically everywhere — no
 * font dependency in Satori (next/og) or across browsers.
 */
const K_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" stroke="${BRAND.ink}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"><path d="M178 120 V392"/><path d="M178 256 L350 120"/><path d="M178 256 L350 392"/></svg>`;

export function kMarkDataUri(): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(K_MARK)}`;
}

/**
 * A square lime tile with the centered "K" mark, sized for a given canvas.
 * Used by the apple-icon and manifest icon routes via next/og's ImageResponse.
 *
 * `maskable` shrinks the glyph into the central safe zone so Android's circular
 * / squircle masking never clips it.
 */
export function AppIconTile({
  size,
  maskable,
}: {
  size: number;
  maskable: boolean;
}): ReactElement {
  const glyph = Math.round(size * (maskable ? 0.56 : 0.66));
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND.lime,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={kMarkDataUri()} width={glyph} height={glyph} alt="" />
    </div>
  );
}
