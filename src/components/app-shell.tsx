"use client";

import { usePathname } from "next/navigation";

/** Tasks stays dark. Systems and Schedules stay cream. Navigation is the header. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const cream = pathname.startsWith("/systems") || pathname.startsWith("/schedules");

  return (
    <div
      className={
        cream
          ? "min-h-[calc(100dvh-2.5rem)] bg-cream-100 text-ink"
          : "min-h-[calc(100dvh-2.5rem)] bg-[#07070b] text-zinc-100"
      }
    >
      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-5 safe-bottom md:px-6 md:py-6">
        {children}
      </main>
    </div>
  );
}
