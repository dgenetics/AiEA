import { redirect } from "next/navigation";

/** Backup if proxy.ts does not run. The proxy sends `/` to `/tasks` with 308. */
export default function HomePage() {
  redirect("/tasks");
}
