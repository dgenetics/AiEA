/** Where login and register land when `next` is missing or unsafe. */
export const DEFAULT_NEXT_PATH = "/tasks";

const MAX_NEXT_LENGTH = 2048;

/**
 * Same-origin relative path only.
 * Rejects absolute URLs, protocol-relative URLs (`//host`), and any backslash.
 * `/login` and `/register` fall back so a signed-in visit cannot loop.
 */
export function safeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") return DEFAULT_NEXT_PATH;
  let value = input.trim();
  if (!value || value.length > MAX_NEXT_LENGTH) return DEFAULT_NEXT_PATH;

  // searchParams already decoded once. Two more passes catch %2F%2F and %5C
  // (and one extra layer of double-encoding) without walking forever.
  for (let i = 0; i < 2; i++) {
    if (!value.includes("%")) break;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      break;
    }
    if (decoded === value) break;
    value = decoded.trim();
    if (!value || value.length > MAX_NEXT_LENGTH) return DEFAULT_NEXT_PATH;
  }

  if (!isSameOriginRelative(value)) return DEFAULT_NEXT_PATH;
  if (isAuthEntry(value)) return DEFAULT_NEXT_PATH;
  return value;
}

export function firstSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function isAuthEntry(value: string): boolean {
  const path = value.split(/[?#]/)[0] ?? value;
  const bare = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return bare === "/login" || bare === "/register";
}

function isSameOriginRelative(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;

  let url: URL;
  try {
    url = new URL(value, "https://farm-manager.local");
  } catch {
    return false;
  }
  if (url.origin !== "https://farm-manager.local") return false;
  if (url.username || url.password) return false;
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return false;
  return true;
}
