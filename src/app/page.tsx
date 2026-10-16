import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  description:
    "Less downtime, fewer surprise repairs, and time back for the work that matters.",
};

/**
 * Public landing page for logged-out visitors.
 * A valid session goes straight to the app. proxy.ts does the same 307
 * when the session cookie is present, so this is the backup if the proxy
 * does not run.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/tasks");
  return <LandingPage />;
}
