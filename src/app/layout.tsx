import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
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
  title: "Farm Manager",
  description: "Systems, schedules, and tasks for the farm. Capture a line and it lands on the board.",
  applicationName: "Farm Manager",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Farm Manager",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#07070b] text-zinc-100">
        {/* useSearchParams() in the shared bar — required for static rendering. */}
        <Suspense
          fallback={
            <header className="site-nav sticky top-0 z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top" />
          }
        >
          <SiteNav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
