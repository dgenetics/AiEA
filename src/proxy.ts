import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function go(
  request: NextRequest,
  pathname: string,
  status: 301 | 307 | 308,
  extra?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (extra) {
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, status);
}

/**
 * Logged-out `/` is the public landing page.
 * A session cookie means this browser is signed in, so `/` goes straight
 * to the app (307). The page repeats that redirect when the proxy does not run.
 * Other retired AiEA pages are 308.
 * Old `/maintenance/*` bookmarks are permanent (301) for one release.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    const session = request.cookies.get("aiea_session")?.value;
    if (session) return go(request, "/tasks", 307);
    return NextResponse.next();
  }

  if (
    path === "/today" ||
    path.startsWith("/today/") ||
    path === "/upcoming" ||
    path.startsWith("/upcoming/") ||
    path === "/inbox" ||
    path.startsWith("/inbox/") ||
    path === "/brief" ||
    path.startsWith("/brief/") ||
    path === "/people" ||
    path.startsWith("/people/") ||
    path === "/areas" ||
    path.startsWith("/areas/") ||
    path === "/capture" ||
    path.startsWith("/capture/") ||
    path === "/recurring" ||
    path.startsWith("/recurring/")
  ) {
    return go(request, "/tasks", 308);
  }

  if (path === "/archive" || path.startsWith("/archive/")) {
    return go(request, "/tasks/done", 308);
  }

  if (path === "/maintenance" || path === "/maintenance/assets") {
    return go(request, "/systems", 301);
  }
  if (path === "/maintenance/assets/new") {
    return go(request, "/systems", 301, { add: "1" });
  }

  const component = path.match(/^\/maintenance\/assets\/([^/]+)\/components\/([^/]+)$/);
  if (component) {
    return go(request, `/systems/${component[1]}/components/${component[2]}`, 301);
  }
  const system = path.match(/^\/maintenance\/assets\/([^/]+)$/);
  if (system && system[1] !== "new") {
    return go(request, `/systems/${system[1]}`, 301);
  }

  if (path === "/maintenance/schedules") return go(request, "/schedules", 301);
  const schedule = path.match(/^\/maintenance\/schedules\/([^/]+)$/);
  if (schedule) return go(request, "/schedules", 301, { id: schedule[1] });

  if (path === "/maintenance/maintenance/archive") return go(request, "/tasks/done", 301);
  if (path === "/maintenance/maintenance" || path.startsWith("/maintenance/maintenance/")) {
    return go(request, "/tasks", 301);
  }
  if (path.startsWith("/maintenance/")) return go(request, "/systems", 301);

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/today/:path*",
    "/upcoming/:path*",
    "/inbox/:path*",
    "/brief/:path*",
    "/people/:path*",
    "/areas/:path*",
    "/capture/:path*",
    "/archive/:path*",
    "/recurring/:path*",
    "/maintenance/:path*",
  ],
};
