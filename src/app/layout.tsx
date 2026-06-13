import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "CoachLoop",
  description: "AI sales-call coaching loop — score, drill the gap, re-score. Built at Claude Build Day.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <div className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-6">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
