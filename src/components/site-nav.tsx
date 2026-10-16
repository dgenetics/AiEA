"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AccountMenu } from "@/components/account-menu";

const TABS = [
  { href: "/systems", label: "Systems" },
  { href: "/schedules", label: "Schedules" },
  { href: "/tasks", label: "Tasks" },
] as const;

function tabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Landing, login, and register draw their own chrome. */
export function isAppChromeHidden(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/")
  );
}

/**
 * Header is only the centered title and an Account icon.
 * Systems, Schedules, and Tasks are a fixed bottom bar at every width.
 * Hidden on the public landing page, login, and register.
 */
export function SiteNav() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const query = search ? `?${search}` : "";
  const [me, setMe] = useState<{ signedIn: boolean; name: string; email: string } | null>(null);

  const authPage = isAppChromeHidden(pathname);

  useEffect(() => {
    if (authPage) return;
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean; name?: string; email?: string }) => {
        if (cancelled) return;
        setMe({
          signedIn: Boolean(data.signedIn),
          name: typeof data.name === "string" ? data.name : "",
          email: typeof data.email === "string" ? data.email : "",
        });
      })
      .catch(() => {
        if (!cancelled) setMe({ signedIn: false, name: "", email: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, query, authPage]);

  if (authPage) return null;

  const current = `${pathname}${query}`;
  const accountHref = `/login?next=${encodeURIComponent(current)}`;

  return (
    <>
      <header className="site-nav sticky top-0 z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top">
        <div className="relative flex h-10 items-center justify-center px-12">
          <span className="text-[13px] font-semibold tracking-tight text-white">Farm Manager</span>
          {me?.signedIn ? (
            <AccountMenu name={me.name} email={me.email} />
          ) : me ? (
            <Link
              href={accountHref}
              aria-label="Sign in"
              className="absolute right-2 top-0 flex h-10 w-10 items-center justify-center text-zinc-400 hover:text-white"
            >
              <User className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="absolute right-2 top-0 flex h-10 w-10 items-center justify-center text-zinc-400"
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </span>
          )}
        </div>
      </header>
      <nav
        aria-label="Farm Manager"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#12141c] pb-[env(safe-area-inset-bottom,0px)]"
      >
        {TABS.map((tab) => {
          const active = tabActive(pathname, tab.href);
          const tone = active ? "font-bold text-white" : "font-medium text-zinc-400";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 items-center justify-center px-2 text-[15px] ${tone}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Skips the app bar on the landing page and auth screens, including its fallback. */
export function SiteNavGate() {
  const pathname = usePathname() || "/";
  if (isAppChromeHidden(pathname)) return null;
  return (
    <Suspense
      fallback={
        <header className="site-nav sticky top-0 z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top" />
      }
    >
      <SiteNav />
    </Suspense>
  );
}
