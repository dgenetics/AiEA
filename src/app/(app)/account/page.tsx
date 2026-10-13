import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { KeyRound, User } from "lucide-react";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Profile details and security.
        </p>
      </div>

      <section className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <User className="h-4 w-4 text-indigo-300" />
          Profile
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Name</dt>
            <dd className="mt-0.5 text-zinc-100">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Email</dt>
            <dd className="mt-0.5 text-zinc-100">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-indigo-300" />
          Change password
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Use a strong password you don&apos;t reuse elsewhere. Other signed-in
          devices will be logged out.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
