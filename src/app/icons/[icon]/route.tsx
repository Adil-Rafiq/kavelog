import { ImageResponse } from "next/og";
import { AppIconTile } from "@/lib/brand-icon";

/**
 * Generated PNG icons referenced by the web app manifest:
 *   /icons/icon-192      192x192  (any)
 *   /icons/icon-512      512x512  (any)
 *   /icons/maskable-512  512x512  (maskable — glyph kept in the safe zone)
 *
 * Rendered on demand via next/og and cached immutably by clients/CDN.
 */
const CONFIG = {
  "icon-192": { size: 192, maskable: false },
  "icon-512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(CONFIG).map((icon) => ({ icon }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ icon: string }> }
) {
  const { icon } = await params;
  const cfg = CONFIG[icon as keyof typeof CONFIG] ?? CONFIG["icon-512"];
  return new ImageResponse(
    <AppIconTile size={cfg.size} maskable={cfg.maskable} />,
    {
      width: cfg.size,
      height: cfg.size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
