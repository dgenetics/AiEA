"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Briefcase,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Repeat,
  Settings,
  Sparkles,
  Sunrise,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { ReminderBell } from "@/components/reminder-bell";
import { AiStatusBadge } from "@/components/ai-status-badge";
import { SignOutButton } from "@/components/sign-out-button";

/** Primary destinations on the mobile bottom bar */
const mobilePrimary = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/capture", label: "Capture", icon: Sparkles },
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays },
] as const;

const mobileMore = [
  { href: "/people", label: "People", icon: Users },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/brief", label: "Daily Brief", icon: Sunrise },
  { href: "/areas", label: "Areas", icon: Briefcase },
  { href: "/account", label: "Account", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Desktop: original sidebar + header + main padding (unchanged).
 * Mobile (&lt; md): top bar, bottom tabs, drawer menu.
 */
export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moreActive = mobileMore.some((n) => isActive(pathname, n.href));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.08),_transparent_40%)]" />

      <div className="relative z-10 flex min-h-screen w-full max-w-[100vw] min-w-0 overflow-x-hidden">
        {/* Desktop sidebar — original component, md+ only */}
        <div className="hidden shrink-0 md:flex">
          <Sidebar userName={userName} />
        </div>

        <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
          {/* Mobile top bar only */}
          <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-white/5 bg-[#07070b]/95 px-3 backdrop-blur-md md:hidden safe-top">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 active:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">AiEA</p>
              <p className="truncate text-[10px] text-zinc-500">{userName}</p>
            </div>
            <AiStatusBadge compact />
            <ReminderBell />
          </header>

          {/* Desktop header — original */}
          <header className="hidden h-14 items-center justify-end gap-3 border-b border-white/5 px-6 md:flex">
            <AiStatusBadge />
            <ReminderBell />
            <SignOutButton />
          </header>

          {/* Main: original desktop padding; mobile only adds bottom tab clearance */}
          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur-md md:hidden safe-bottom"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {mobilePrimary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition",
                  active ? "text-indigo-300" : "text-zinc-500 active:text-zinc-300",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-indigo-300")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition",
              moreActive || drawerOpen
                ? "text-indigo-300"
                : "text-zinc-500 active:text-zinc-300",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-white/10 bg-zinc-950 shadow-2xl safe-top safe-bottom">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                  A
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Menu</p>
                  <p className="text-[11px] text-zinc-500">{userName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 active:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Main
              </p>
              {mobilePrimary.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                      active
                        ? "bg-white/10 text-white"
                        : "text-zinc-300 active:bg-white/5",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-indigo-300/80" />
                    {item.label}
                  </Link>
                );
              })}
              <p className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                More
              </p>
              {mobileMore.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                      active
                        ? "bg-white/10 text-white"
                        : "text-zinc-300 active:bg-white/5",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-zinc-400" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/5 p-3">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-zinc-300 active:bg-rose-500/10 active:text-rose-200"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
