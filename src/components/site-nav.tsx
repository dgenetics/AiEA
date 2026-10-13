"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/systems", label: "Systems" },
  { href: "/schedules", label: "Schedules" },
  { href: "/tasks", label: "Tasks" },
] as const;

function tabActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One header for Farm Manager. Account is a link, not a tab.
 * Hidden on the login and register pages, which sit outside the shell.
 */
export function SiteNav() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const query = search ? `?${search}` : "";
  const [signedIn, setSignedIn] = useState(false);

  const authPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/");

  useEffect(() => {
    if (authPage) return;
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data: { signedIn?: boolean }) => {
        if (!cancelled) setSignedIn(Boolean(data.signedIn));
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, query, authPage]);

  if (authPage) return null;

  const current = `${pathname}${query}`;
  const accountHref = signedIn ? "/account" : `/login?next=${encodeURIComponent(current)}`;
  const accountLabel = signedIn ? "Account" : "Sign in";

  return (
    <header className="site-nav sticky top-0 z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top">
      <nav
        aria-label="Farm Manager"
        className="flex h-10 items-stretch gap-0.5 overflow-x-auto px-3 sm:gap-1 sm:px-4"
      >
        <Link
          href="/tasks"
          className="mr-1.5 flex shrink-0 items-center text-[13px] font-semibold tracking-tight text-white"
        >
          Farm Manager
        </Link>
        {TABS.map((tab) => {
          const active = tabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex shrink-0 items-center border-b-[3px] border-indigo-300 px-2.5 text-[13px] font-medium text-white"
                  : "flex shrink-0 items-center border-b-[3px] border-transparent px-2.5 text-[13px] font-medium text-zinc-400 hover:text-zinc-100"
              }
            >
              {tab.label}
            </Link>
          );
        })}
        <Link
          href={accountHref}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 px-2 text-[13px] text-zinc-400 hover:text-white"
        >
          <span aria-hidden="true">•</span>
          {accountLabel}
        </Link>
      </nav>
    </header>
  );
}
