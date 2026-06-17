import { ImageResponse } from "next/og";
import { AppIconTile } from "@/lib/brand-icon";

// iOS home-screen icon. iOS applies its own rounded-corner mask, so the tile
// is full-bleed lime with the centered mark.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconTile size={size.width} maskable={false} />, {
    ...size,
  });
}
