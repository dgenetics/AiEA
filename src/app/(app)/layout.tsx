import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { ReminderBell } from "@/components/reminder-bell";
import { AiStatusBadge } from "@/components/ai-status-badge";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#07070b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.08),_transparent_40%)]" />
      <div className="relative z-10 flex min-h-screen w-full">
        <Sidebar userName={user.name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-end gap-3 border-b border-white/5 px-6">
            <AiStatusBadge />
            <ReminderBell />
            <SignOutButton />
          </header>
          <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
