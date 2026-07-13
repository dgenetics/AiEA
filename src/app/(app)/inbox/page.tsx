import { redirect } from "next/navigation";

/**
 * Inbox is unused with the Capture → propose → accept flow
 * (accepted tasks go straight to Active / Today).
 * Keep this route as a redirect so old bookmarks don't 404.
 */
export default function InboxPage() {
  redirect("/capture");
}
