"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Briefcase,
  CalendarDays,
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
import { cn } from "@/lib/utils";
import { ReminderBell } from "@/components/reminder-bell";
import { AiStatusBadge } from "@/components/ai-status-badge";

const primaryNav = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/capture", label: "Capture", icon: Sparkles },
  { href: "/upcoming", label: "Plan", icon: CalendarDays },
] as const;

const moreNav = [
  { href: "/people", label: "People", icon: Users },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/brief", label: "Daily Brief", icon: Sunrise },
  { href: "/areas", label: "Areas", icon: Briefcase },
  { href: "/account", label: "Account", icon: Settings },
] as const;

const allNav = [...primaryNav, ...moreNav];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

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
  const moreActive = moreNav.some((n) => isActive(pathname, n.href));

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer open
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
    <div className="flex min-h-[100dvh] bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.08),_transparent_40%)]" />

      <div className="relative z-10 flex min-h-[100dvh] w-full">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-zinc-950/80 px-3 py-5 md:flex">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
                A
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-white">
                  AiEA
                </p>
                <p className="text-[11px] text-zinc-500">Executive Assistant</p>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5">
            {allNav.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                    active
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-indigo-300" : "text-zinc-500",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/5 pt-4">
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-200">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">{userName}</p>
                <Link
                  href="/account"
                  className="text-[11px] text-zinc-500 transition hover:text-indigo-300"
                >
                  Account & password
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-300 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
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

          {/* Desktop top bar */}
          <header className="hidden h-14 items-center justify-end gap-3 border-b border-white/5 px-6 md:flex">
            <AiStatusBadge />
            <ReminderBell />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-200"
            >
              Sign out
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom tabs ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur-md md:hidden safe-bottom"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {primaryNav.map((item) => {
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

      {/* ── Mobile drawer ── */}
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
              {primaryNav.map((item) => {
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
              {moreNav.map((item) => {
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
