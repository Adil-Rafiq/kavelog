import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "KaveLog",
  title: "KaveLog — Attendance",
  description:
    "Self-managed attendance tracking for Kavelogics employees. Not affiliated with the company.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KaveLog",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0D12",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
        <PwaRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
