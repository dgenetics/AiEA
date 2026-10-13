/** Where login and register land when `next` is missing or rejected. */
export const DEFAULT_NEXT_PATH = "/tasks";

/**
 * Honor `next` only when it is a same-origin relative path.
 * The URL parser strips tab, newline, and carriage return before parsing,
 * so `/\t/evil.com` and `/\n/evil.com` become `//evil.com` (another host).
 * Reject those, every other C0 control and DEL, backslash, and anything
 * whose parsed origin is not the dummy base.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") return DEFAULT_NEXT_PATH;
  if (CONTROL_CHARS.test(input)) return DEFAULT_NEXT_PATH;
  if (!input.startsWith("/")) return DEFAULT_NEXT_PATH;
  if (input.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (input.includes("\\")) return DEFAULT_NEXT_PATH;
  const pathOnly = input.split(/[?#]/)[0] || "/";
  const bare = pathOnly.length > 1 && pathOnly.endsWith("/") ? pathOnly.slice(0, -1) : pathOnly;
  if (bare === "/maintenance" || bare.startsWith("/maintenance/")) return DEFAULT_NEXT_PATH;
  try {
    if (new URL(input, "http://x").origin !== "http://x") return DEFAULT_NEXT_PATH;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
  return input;
}

/**
 * Same rule as safeNextPath, except a signed-in redirect to /login or
 * /register would loop. Those two paths land on /tasks.
 */
export function signedInNextPath(input: string | null | undefined): string {
  const dest = safeNextPath(input);
  const path = dest.split(/[?#]/)[0] || "/";
  const bare = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (bare === "/login" || bare === "/register") return DEFAULT_NEXT_PATH;
  return dest;
}

export function firstSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}
