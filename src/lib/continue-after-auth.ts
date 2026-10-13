type AppRouter = {
  push: (href: string) => void;
  refresh: () => void;
};

/**
 * Leave login/register for a path `safeNextPath` already accepted.
 * `/maintenance` is a rewrite to the other app. `router.push` asks this
 * app for an RSC payload that zone does not serve, so the browser loads
 * the document instead.
 */
export function continueAfterAuth(router: AppRouter, dest: string) {
  const path = dest.split(/[?#]/)[0] || "/";
  if (path === "/maintenance" || path.startsWith("/maintenance/")) {
    window.location.assign(dest);
    return;
  }
  router.push(dest);
  router.refresh();
}
