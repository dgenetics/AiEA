import { redirect } from "next/navigation";

/** Old account links land on Tasks. Profile and password live in the header menu. */
export default function AccountPage() {
  redirect("/tasks");
}
