import { MotionConfig } from "motion/react";
import type { Metadata } from "next";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_URL } from "@/lib/constants";
import { clashDisplay, generalSans } from "./fonts/local-fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Resolves relative canonical/OG URLs (incl. the per-cat opengraph-image).
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: SITE_LOCALE, type: "website" },
  twitter: { card: "summary_large_image" },
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
