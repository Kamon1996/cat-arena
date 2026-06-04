import { MotionConfig } from "motion/react";
import type { Metadata } from "next";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { clashDisplay, generalSans } from "./fonts/local-fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WhosMeowing", template: "%s | WhosMeowing" },
  description: "Pick the better of two cats in 1-vs-1 duels and watch them climb the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${clashDisplay.variable} ${generalSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <MotionConfig reducedMotion="user">
            <QueryProvider>{children}</QueryProvider>
          </MotionConfig>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
