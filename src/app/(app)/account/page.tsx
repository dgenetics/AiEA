import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { KeyRound, User } from "lucide-react";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-forest-800">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Your account</h1>
        <p className="mt-1 text-sm text-muted">
          Profile details and security.
        </p>
      </div>

      <section className="rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-[0_1px_2px_#1c19170d]">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <User className="h-4 w-4 text-forest-800" />
          Profile
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Name</dt>
            <dd className="mt-0.5 text-ink">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-0.5 text-ink">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-[0_1px_2px_#1c19170d]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-forest-800" />
          Change password
        </div>
        <p className="mb-4 text-xs text-muted">
          Use a strong password you don&apos;t reuse elsewhere. Other signed-in
          devices will be logged out.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
