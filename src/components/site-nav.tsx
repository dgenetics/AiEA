"use client";

import { usePathname } from "next/navigation";

/**
 * Shared switcher for the two apps on one domain.
 * Plain <a> tags: Next <Link> would prefetch /maintenance inside AiEA.
 * Copy into bf-maintenance and pass zone="maintenance" — usePathname()
 * there omits basePath, so it cannot detect the zone on its own.
 */
export function SiteNav({
  signedIn,
  zone = "tasks",
}: {
  signedIn: boolean;
  zone?: "tasks" | "maintenance";
}) {
  const pathname = usePathname() || "/";
  const onMaintenance =
    zone === "maintenance" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/maintenance/");
  const accountHref = signedIn ? "/account" : "/login";
  const accountLabel = signedIn ? "Account" : "Sign in";

  return (
    <header className="site-nav relative z-40 min-h-10 shrink-0 border-b border-white/10 bg-[#12141c] safe-top">
      <nav
        aria-label="Farm Manager"
        className="flex h-10 items-center gap-0.5 overflow-x-auto px-3 sm:gap-1 sm:px-4"
      >
        <span className="mr-1.5 shrink-0 text-[13px] font-semibold tracking-tight text-white">
          Farm Manager
        </span>
        {/* Raw anchors, not next/link: this bar is copied into bf-maintenance,
            where Link would prefix basePath and prefetch the other zone. */}
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
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-zinc-400 hover:text-white"
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
    ? "shrink-0 rounded-md bg-[#0c0e14] px-2.5 py-1 text-[13px] font-medium text-white"
    : "shrink-0 rounded-md px-2.5 py-1 text-[13px] font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-100";
}
