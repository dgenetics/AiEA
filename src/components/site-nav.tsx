"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Shared switcher for the two apps on one domain.
 * Plain <a> tags: Next <Link> would prefetch /maintenance inside AiEA,
 * and in bf-maintenance it would prefix basePath.
 * Copy into bf-maintenance and pass zone="maintenance". usePathname()
 * there omits basePath, so Sign in's next prefixes /maintenance.
 *
 * Both zones share aiea_session. Account goes to /account.
 * Sign in goes to /login?next=<current path and query>.
 * Wrap this component in <Suspense> because it reads useSearchParams().
 */
export function SiteNav({
  zone = "tasks",
}: {
  zone?: "tasks" | "maintenance";
}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const query = search ? `?${search}` : "";
  const onMaintenance =
    zone === "maintenance" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/maintenance/");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
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
  }, [pathname, query]);

  const current =
    pathname === "/maintenance" || pathname.startsWith("/maintenance/")
      ? `${pathname}${query}`
      : zone === "maintenance"
        ? `/maintenance${pathname === "/" ? "" : pathname}${query}`
        : `${pathname}${query}`;
  const accountHref = signedIn
    ? "/account"
    : `/login?next=${encodeURIComponent(current)}`;
  const accountLabel = signedIn ? "Account" : "Sign in";

  return (
    <header className="site-nav sticky top-0 z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top">
      <nav
        aria-label="Farm Manager"
        className="flex h-10 items-stretch gap-0.5 overflow-x-auto px-3 sm:gap-1 sm:px-4"
      >
        <span className="mr-1.5 flex shrink-0 items-center text-[13px] font-semibold tracking-tight text-white">
          Farm Manager
        </span>
        {/* Raw anchors, not next/link: copied into bf-maintenance, Link would prefix basePath. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          aria-current={onMaintenance ? undefined : "page"}
          className={tabClass(!onMaintenance)}
        >
          Tasks (AiEA)
        </a>
        <a
          href="/maintenance"
          aria-current={onMaintenance ? "page" : undefined}
          className={tabClass(onMaintenance)}
        >
          Maintenance
        </a>
        <a
          href={accountHref}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 px-2 text-[13px] text-zinc-400 hover:text-white"
        >
          <span aria-hidden="true">•</span>
          {accountLabel}
        </a>
      </nav>
    </header>
  );
}

function tabClass(active: boolean) {
  return active
    ? "flex shrink-0 items-center border-b-[3px] border-indigo-300 px-2.5 text-[13px] font-medium text-white"
    : "flex shrink-0 items-center border-b-[3px] border-transparent px-2.5 text-[13px] font-medium text-zinc-400 hover:text-zinc-100";
}
