import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { firstSearchParam, signedInNextPath } from "@/lib/safe-next";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = firstSearchParam((await searchParams).next);
  const user = await getCurrentUser();
  if (user) redirect(signedInNextPath(next));
  return <RegisterForm next={next} />;
}
