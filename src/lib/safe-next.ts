/** Where login and register land when `next` is missing or rejected. */
export const DEFAULT_NEXT_PATH = "/tasks";

/**
 * Honor `next` only when it is a relative path: starts with `/`,
 * does not start with `//`, and contains no backslash. Otherwise `/tasks`.
 * The value is the one from the query string (already decoded once).
 */
export function safeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") return DEFAULT_NEXT_PATH;
  if (!input.startsWith("/")) return DEFAULT_NEXT_PATH;
  if (input.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (input.includes("\\")) return DEFAULT_NEXT_PATH;
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
