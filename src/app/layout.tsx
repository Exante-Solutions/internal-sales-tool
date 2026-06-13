import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";
import { TourProvider } from "@/components/tour/tour-provider";

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
        <TourProvider>
          <AppNav />
          <div className="lg:pl-60">
            <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-6 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-10">
              {children}
            </div>
          </div>
        </TourProvider>
      </body>
    </html>
  );
}
