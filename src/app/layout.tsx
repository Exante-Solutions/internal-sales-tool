import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoachLoop",
  description: "AI sales-call coaching loop — built at Claude Build Day.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
