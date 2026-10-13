import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Session probe for the Farm Manager bar. Does not belong in the root layout. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ signedIn: false });
  return NextResponse.json({
    signedIn: true,
    name: user.name,
    email: user.email,
  });
}
