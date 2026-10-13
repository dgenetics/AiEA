import { NextResponse } from "next/server";
import { getSessionIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
} as const;

/**
 * Suite session verifier for other Farm Manager zones (bf-maintenance).
 *
 * bf calls this server-side, on the same host the browser used:
 *   GET {AIEA_URL}/api/session
 *   Cookie: <the incoming Cookie header, forwarded unchanged>
 * Never log that header or the aiea_session value.
 *
 * 200
 *   { user: { id, email, name }, expiresAt: "<ISO-8601>" }
 * 401
 *   { error: "Unauthorized" }
 *   Missing cookie, unknown token, or expiresAt in the past.
 *   An expired row is deleted here. bf must not delete it.
 *
 * The cookie is the only credential. BF_INTEGRATION_SECRET is ignored.
 * Cache-Control is no-store. bf may keep an in-memory copy for 30–60s,
 * keyed by the sha256 of the token, and must drop it on 401.
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
