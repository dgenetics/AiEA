"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  CalendarDays,
  Home,
  LayoutDashboard,
  LogOut,
  Repeat,
  Sparkles,
  Sunrise,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/capture", label: "Capture", icon: Sparkles },
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays },
  { href: "/people", label: "People", icon: Users },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/brief", label: "Daily Brief", icon: Sunrise },
  { href: "/areas", label: "Areas", icon: Briefcase },
];

export function Sidebar({
  userName,
  pendingReminders = 0,
}: {
  userName: string;
  pendingReminders?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-white/5 bg-zinc-950/80 px-3 py-5">
      <div className="mb-8 px-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
            A
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">AiEA</p>
            <p className="text-[11px] text-zinc-500">Executive Assistant</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
              <Icon className={cn("h-4 w-4", active ? "text-indigo-300" : "text-zinc-500")} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/today" && pendingReminders > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                  {pendingReminders}
                </span>
              )}
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
            <p className="text-[11px] text-zinc-500">Personal workspace</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/80 px-2.5 py-2 text-[11px] text-zinc-500">
          <Home className="h-3.5 w-3.5" />
          <span>Work · Home · Life</span>
          <Bell className="ml-auto h-3.5 w-3.5 text-zinc-600" />
        </div>
      </div>
    </aside>
  );
}
