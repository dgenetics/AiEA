"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Inbox,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Sunrise,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/tasks", label: "Tasks", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/capture", label: "Capture", icon: Sparkles },
  { href: "/people", label: "People", icon: Users },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/brief", label: "Daily Brief", icon: Sunrise },
  { href: "/account", label: "Account", icon: Settings },
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
              {item.href === "/tasks" && pendingReminders > 0 && (
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
  );
}
