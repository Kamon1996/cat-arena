import { MotionConfig } from "motion/react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Cat Arena", template: "%s | Cat Arena" },
  description: "Pick the better of two cats in 1-vs-1 duels and watch them climb the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <MotionConfig reducedMotion="user">
          <QueryProvider>{children}</QueryProvider>
        </MotionConfig>
        <Toaster />
      </body>
    </html>
  );
}
