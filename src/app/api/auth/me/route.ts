import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Session probe for the Farm Manager bar. Does not belong in the root layout. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ signedIn: Boolean(user) });
}
