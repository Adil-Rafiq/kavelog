import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KaveLog — Attendance",
  description:
    "Self-managed attendance tracking for Kavelogics employees. Not affiliated with the company.",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
