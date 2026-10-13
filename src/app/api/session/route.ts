import { NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

/**
 * Session verifier. The cookie is the only credential.
 *
 * A caller on this host can check:
 *   GET {AIEA_URL}/api/session
 *   Cookie: <the incoming Cookie header, forwarded unchanged>
 * Never log that header or the aiea_session value.
 *
 * 200
 *   { user: { id, email, name }, expiresAt: "<ISO-8601>" }
 * 401
 *   { error: "Unauthorized" }
 *   Missing cookie, unknown token, or expiresAt in the past.
 *   An expired row is deleted here.
 *
 * Cache-Control is no-store.
 */
export async function GET() {
  const session = await getSessionIdentity();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      expiresAt: session.expiresAt.toISOString(),
    },
    { headers: NO_STORE },
  );
}
