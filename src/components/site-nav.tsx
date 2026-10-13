"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Shared switcher for the two apps on one domain.
 * Plain <a> tags: Next <Link> would prefetch /maintenance inside AiEA,
 * and in bf-maintenance it would prefix basePath.
 * Copy this file into bf-maintenance and pass zone="maintenance".
 * usePathname() there omits basePath, so the zone prop is how that
 * copy knows which tab is current. The return path uses
 * window.location so /login?next= keeps the /maintenance prefix.
 *
 * One suite session: aiea_session (Path=/). Both zones show Sign in
 * or Account. Sign in returns here via /login?next=. Account is /account.
 * The probe is GET /api/auth/me on this host (not under /maintenance).
 */
export function SiteNav({
  zone = "tasks",
}: {
  zone?: "tasks" | "maintenance";
}) {
  const pathname = usePathname() || "/";
  const onMaintenance =
    zone === "maintenance" ||
    pathname === "/maintenance" ||
    pathname.startsWith("/maintenance/");
  const [signedIn, setSignedIn] = useState(false);
  const returnTo = useSyncExternalStore(
    subscribeToLocation,
    currentReturnPath,
    serverReturnPath,
  );

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
  }, [pathname]);

  const accountHref = signedIn ? "/account" : `/login?next=${encodeURIComponent(returnTo)}`;
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

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function serverReturnPath() {
  return "/tasks";
}

/** Full browser path + query. usePathname() drops bf-maintenance's basePath. */
function currentReturnPath(): string {
  const path = window.location.pathname || "/";
  const search = window.location.search || "";
  if (path === "/login" || path === "/register") {
    const existing = new URLSearchParams(search).get("next");
    if (
      existing &&
      existing.startsWith("/") &&
      !existing.startsWith("//") &&
      !existing.includes("\\")
    ) {
      const only = existing.split(/[?#]/)[0] ?? existing;
      const bare = only.length > 1 && only.endsWith("/") ? only.slice(0, -1) : only;
      if (bare !== "/login" && bare !== "/register") return existing;
    }
    return "/tasks";
  }
  return `${path}${search}` || "/tasks";
}

function tabClass(active: boolean) {
  return active
    ? "flex shrink-0 items-center border-b-[3px] border-indigo-300 px-2.5 text-[13px] font-medium text-white"
    : "flex shrink-0 items-center border-b-[3px] border-transparent px-2.5 text-[13px] font-medium text-zinc-400 hover:text-zinc-100";
}
